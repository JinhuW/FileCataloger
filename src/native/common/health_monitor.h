#pragma once
#include <atomic>
#include <chrono>
#include <functional>
#include <thread>
#include <vector>
#include <map>

class HealthMonitor {
public:
    enum class HealthStatus {
        HEALTHY,
        DEGRADED,
        UNHEALTHY,
        CRITICAL
    };

    struct HealthMetrics {
        uint64_t lastEventTime;
        uint64_t eventsProcessed;
        uint64_t errorsCount;
        double avgLatencyMs;
        double cpuUsage;
        size_t memoryUsageMB;
        HealthStatus status;
    };

private:
    // Health thresholds
    static constexpr uint64_t EVENT_TIMEOUT_MS = 5000;      // No events for 5s
    static constexpr uint64_t CRITICAL_TIMEOUT_MS = 30000;  // No events for 30s
    static constexpr double HIGH_LATENCY_MS = 100.0;        // >100ms is high
    static constexpr double CRITICAL_LATENCY_MS = 500.0;    // >500ms is critical
    static constexpr size_t HIGH_MEMORY_MB = 100;            // >100MB is high
    static constexpr size_t CRITICAL_MEMORY_MB = 500;        // >500MB is critical

    // Metrics tracking
    std::atomic<uint64_t> lastEventTime_{0};
    std::atomic<uint64_t> eventsProcessed_{0};
    std::atomic<uint64_t> errorsCount_{0};
    std::atomic<uint64_t> totalLatency_{0};  // Sum of all latencies
    std::atomic<uint64_t> latencyCount_{0};  // Number of latency measurements

    // Module-specific metrics
    struct ModuleHealth {
        std::atomic<uint64_t> lastActivity{0};
        std::atomic<uint64_t> errorCount{0};
        std::atomic<bool> isResponding{true};
        std::function<void()> recoveryAction;
    };

    std::map<std::string, ModuleHealth> modules_;

    // Monitoring thread
    std::thread monitorThread_;
    std::atomic<bool> running_{false};

    // Callbacks
    std::function<void(HealthStatus)> statusChangeCallback_;
    std::function<void(const std::string&)> recoveryCallback_;

public:
    HealthMonitor() = default;

    ~HealthMonitor() {
        stop();
    }

    void start() {
        if (running_.exchange(true)) {
            return;  // Already running
        }

        monitorThread_ = std::thread([this] {
            monitorLoop();
        });
    }

    void stop() {
        if (!running_.exchange(false)) {
            return;  // Not running
        }

        if (monitorThread_.joinable()) {
            monitorThread_.join();
        }
    }

    // Register a module for health monitoring
    void registerModule(const std::string& name, std::function<void()> recoveryAction = nullptr) {
        ModuleHealth module;
        module.recoveryAction = recoveryAction;
        modules_[name] = module;
    }

    // Report module activity
    void reportActivity(const std::string& module) {
        auto it = modules_.find(module);
        if (it != modules_.end()) {
            it->second.lastActivity = getCurrentTimeMs();
            it->second.isResponding = true;
        }
        lastEventTime_ = getCurrentTimeMs();
        eventsProcessed_.fetch_add(1);
    }

    // Report module error
    void reportError(const std::string& module, const std::string& error) {
        auto it = modules_.find(module);
        if (it != modules_.end()) {
            it->second.errorCount.fetch_add(1);
        }
        errorsCount_.fetch_add(1);
    }

    // Report latency measurement
    void reportLatency(double latencyMs) {
        totalLatency_.fetch_add(static_cast<uint64_t>(latencyMs * 1000));
        latencyCount_.fetch_add(1);
    }

    // Get current health status
    HealthStatus getStatus() const {
        uint64_t now = getCurrentTimeMs();
        uint64_t lastEvent = lastEventTime_.load();
        uint64_t timeSinceEvent = now - lastEvent;

        // Check for critical timeout
        if (timeSinceEvent > CRITICAL_TIMEOUT_MS) {
            return HealthStatus::CRITICAL;
        }

        // Check for event timeout
        if (timeSinceEvent > EVENT_TIMEOUT_MS) {
            return HealthStatus::UNHEALTHY;
        }

        // Check average latency
        double avgLatency = getAverageLatency();
        if (avgLatency > CRITICAL_LATENCY_MS) {
            return HealthStatus::CRITICAL;
        }
        if (avgLatency > HIGH_LATENCY_MS) {
            return HealthStatus::DEGRADED;
        }

        // Check error rate
        uint64_t errors = errorsCount_.load();
        uint64_t events = eventsProcessed_.load();
        if (events > 0) {
            double errorRate = static_cast<double>(errors) / events;
            if (errorRate > 0.1) {  // >10% error rate
                return HealthStatus::UNHEALTHY;
            }
            if (errorRate > 0.05) {  // >5% error rate
                return HealthStatus::DEGRADED;
            }
        }

        // Check module health
        for (const auto& [name, module] : modules_) {
            if (!module.isResponding.load()) {
                return HealthStatus::DEGRADED;
            }
        }

        return HealthStatus::HEALTHY;
    }

    // Get detailed metrics
    HealthMetrics getMetrics() const {
        return {
            .lastEventTime = lastEventTime_.load(),
            .eventsProcessed = eventsProcessed_.load(),
            .errorsCount = errorsCount_.load(),
            .avgLatencyMs = getAverageLatency(),
            .cpuUsage = getCpuUsage(),
            .memoryUsageMB = getMemoryUsage(),
            .status = getStatus()
        };
    }

    // Set callbacks
    void onStatusChange(std::function<void(HealthStatus)> callback) {
        statusChangeCallback_ = callback;
    }

    void onRecovery(std::function<void(const std::string&)> callback) {
        recoveryCallback_ = callback;
    }

    // Force recovery attempt for a module
    void attemptRecovery(const std::string& module) {
        auto it = modules_.find(module);
        if (it != modules_.end() && it->second.recoveryAction) {
            it->second.recoveryAction();
            if (recoveryCallback_) {
                recoveryCallback_(module);
            }
        }
    }

private:
    void monitorLoop() {
        HealthStatus lastStatus = HealthStatus::HEALTHY;

        while (running_.load()) {
            std::this_thread::sleep_for(std::chrono::seconds(1));

            // Check overall health
            HealthStatus currentStatus = getStatus();
            if (currentStatus != lastStatus && statusChangeCallback_) {
                statusChangeCallback_(currentStatus);
            }
            lastStatus = currentStatus;

            // Check module health
            uint64_t now = getCurrentTimeMs();
            for (auto& [name, module] : modules_) {
                uint64_t lastActivity = module.lastActivity.load();
                if (lastActivity > 0 && (now - lastActivity) > EVENT_TIMEOUT_MS) {
                    if (module.isResponding.exchange(false)) {
                        // Module just became unresponsive
                        if (module.recoveryAction) {
                            // Attempt automatic recovery
                            module.recoveryAction();
                            if (recoveryCallback_) {
                                recoveryCallback_(name);
                            }
                        }
                    }
                }
            }

            // Perform cleanup if in critical state
            if (currentStatus == HealthStatus::CRITICAL) {
                performEmergencyCleanup();
            }
        }
    }

    void performEmergencyCleanup() {
        // Reset metrics
        errorsCount_.store(0);
        totalLatency_.store(0);
        latencyCount_.store(0);

        // Attempt recovery for all modules
        for (auto& [name, module] : modules_) {
            if (!module.isResponding.load() && module.recoveryAction) {
                module.recoveryAction();
            }
        }
    }

    double getAverageLatency() const {
        uint64_t count = latencyCount_.load();
        if (count == 0) return 0.0;
        uint64_t total = totalLatency_.load();
        return static_cast<double>(total) / (count * 1000.0);  // Convert back to ms
    }

    double getCpuUsage() const {
        // Simplified CPU usage - would need platform-specific implementation
        // For now, return estimated based on event rate
        uint64_t events = eventsProcessed_.load();
        if (events == 0) return 0.0;

        // Estimate: >10000 events/sec = high CPU
        double eventsPerSec = events / (getCurrentTimeMs() / 1000.0);
        return std::min(100.0, eventsPerSec / 100.0);  // Scale to percentage
    }

    size_t getMemoryUsage() const {
        // Simplified memory usage - would need platform-specific implementation
        // For macOS: task_info() would give actual memory
        return 50;  // Placeholder
    }

    static uint64_t getCurrentTimeMs() {
        using namespace std::chrono;
        return duration_cast<milliseconds>(
            steady_clock::now().time_since_epoch()
        ).count();
    }
};