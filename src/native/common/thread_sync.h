#pragma once
#include <atomic>
#include <thread>

// Platform-optimized memory ordering for ARM64 and x64
class ThreadSync {
public:
    // ARM64 requires stronger memory ordering than x64 for certain operations
    // This abstraction ensures correct behavior on both architectures

#if defined(__aarch64__) || defined(__arm64__)
    // ARM64: Use acquire-release semantics for visibility guarantees
    static constexpr std::memory_order LOAD_ORDER = std::memory_order_acquire;
    static constexpr std::memory_order STORE_ORDER = std::memory_order_release;
    static constexpr std::memory_order RMW_ORDER = std::memory_order_acq_rel;
#else
    // x64: Can use relaxed ordering due to stronger memory model
    static constexpr std::memory_order LOAD_ORDER = std::memory_order_relaxed;
    static constexpr std::memory_order STORE_ORDER = std::memory_order_relaxed;
    static constexpr std::memory_order RMW_ORDER = std::memory_order_relaxed;
#endif

    // Optimized spinlock with exponential backoff
    class SpinLock {
    private:
        std::atomic<bool> locked_{false};

    public:
        void lock() {
            // Exponential backoff parameters
            static constexpr int MAX_SPINS = 64;
            static constexpr int BACKOFF_INIT = 4;
            static constexpr int BACKOFF_MAX = 256;

            int backoff = BACKOFF_INIT;

            while (true) {
                // Try to acquire lock with weak CAS (can fail spuriously but faster)
                bool expected = false;
                if (locked_.compare_exchange_weak(expected, true, RMW_ORDER)) {
                    return;
                }

                // Exponential backoff
                for (int i = 0; i < backoff; ++i) {
                    // CPU pause instruction for efficiency
#if defined(__x86_64__) || defined(__i386__)
                    __asm__ volatile("pause");
#elif defined(__aarch64__) || defined(__arm64__)
                    __asm__ volatile("yield");
#else
                    std::this_thread::yield();
#endif
                }

                // Increase backoff up to maximum
                backoff = std::min(backoff * 2, BACKOFF_MAX);
            }
        }

        bool try_lock() {
            bool expected = false;
            return locked_.compare_exchange_strong(expected, true, RMW_ORDER);
        }

        void unlock() {
            locked_.store(false, STORE_ORDER);
        }
    };

    // Seqlock for low-contention reads (perfect for metrics/stats)
    template<typename T>
    class SeqLock {
    private:
        alignas(64) std::atomic<uint64_t> seq_{0};
        alignas(64) T data_;

    public:
        // Writer (only one thread should write)
        void write(const T& value) {
            uint64_t seq = seq_.fetch_add(1, STORE_ORDER);
            // Odd sequence number indicates write in progress

            data_ = value;

            // Memory fence to ensure data write completes before sequence update
            std::atomic_thread_fence(std::memory_order_release);

            seq_.fetch_add(1, STORE_ORDER);
            // Even sequence number indicates write complete
        }

        // Reader (multiple threads can read)
        bool read(T& value) const {
            uint64_t seq1, seq2;

            do {
                seq1 = seq_.load(LOAD_ORDER);

                // If odd, write is in progress
                if (seq1 & 1) {
                    continue;
                }

                // Memory fence to ensure we read data after sequence
                std::atomic_thread_fence(std::memory_order_acquire);

                value = data_;

                // Memory fence before re-reading sequence
                std::atomic_thread_fence(std::memory_order_acquire);

                seq2 = seq_.load(LOAD_ORDER);

            } while (seq1 != seq2);  // Retry if sequence changed

            return true;
        }
    };

    // Double-buffering for lock-free updates
    template<typename T>
    class DoubleBuffer {
    private:
        alignas(64) T buffers_[2];
        alignas(64) std::atomic<int> active_{0};
        alignas(64) std::atomic<bool> updating_{false};

    public:
        // Reader gets active buffer
        const T& read() const {
            return buffers_[active_.load(LOAD_ORDER)];
        }

        // Writer updates inactive buffer then swaps
        template<typename Updater>
        void update(Updater&& updater) {
            // Ensure only one writer at a time
            bool expected = false;
            while (!updating_.compare_exchange_weak(expected, true, RMW_ORDER)) {
                expected = false;
                std::this_thread::yield();
            }

            // Get inactive buffer index
            int inactive = 1 - active_.load(LOAD_ORDER);

            // Update inactive buffer
            updater(buffers_[inactive]);

            // Ensure update is visible before swap
            std::atomic_thread_fence(std::memory_order_release);

            // Atomic swap to new buffer
            active_.store(inactive, STORE_ORDER);

            // Release update lock
            updating_.store(false, STORE_ORDER);
        }
    };
};