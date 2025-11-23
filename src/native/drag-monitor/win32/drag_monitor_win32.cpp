/**
 * @file drag_monitor_win32.cpp
 * @brief Windows native drag monitor using OLE and mouse hooks
 *
 * This module implements file drag detection for Windows using a combination
 * of low-level mouse hooks and OLE drag-drop monitoring. It detects when files
 * are being dragged from Explorer or other applications.
 *
 * Architecture:
 * - SetWindowsHookEx for mouse event interception
 * - OleGetClipboard for drag data detection
 * - IDataObject parsing for file extraction
 * - N-API for JavaScript integration
 *
 * @author FileCataloger Team
 * @date 2025
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <ole2.h>
#include <shlobj.h>
#include <shellapi.h>
#include <napi.h>
#include <thread>
#include <atomic>
#include <mutex>
#include <vector>
#include <string>
#include <chrono>
#include <deque>
#include <condition_variable>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

class WindowsDragMonitor : public Napi::ObjectWrap<WindowsDragMonitor> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    WindowsDragMonitor(const Napi::CallbackInfo& info);
    ~WindowsDragMonitor();

private:
    static Napi::FunctionReference constructor;

    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value IsMonitoring(const Napi::CallbackInfo& info);
    Napi::Value HasActiveDrag(const Napi::CallbackInfo& info);
    Napi::Value GetFileCount(const Napi::CallbackInfo& info);
    Napi::Value GetDraggedFiles(const Napi::CallbackInfo& info);

    void MonitoringLoop();
    bool CheckForFileDrag();
    bool ExtractFilesFromDataObject(IDataObject* dataObject);

    std::thread* monitoringThread;
    std::atomic<bool> isMonitoringFlag;
    std::atomic<bool> shouldStop;
    std::atomic<bool> isDragging;

    // Polling state
    std::atomic<bool> hasActiveDragFlag;
    std::atomic<int> fileCount;
    std::vector<std::wstring> draggedFilePaths;
    std::mutex filePathsMutex;

    // Mouse hook
    HHOOK mouseHook;
    DWORD hookThreadId;

    // Drag state tracking
    struct DragState {
        POINT startPoint;
        POINT lastPoint;
        std::chrono::steady_clock::time_point startTime;
        std::chrono::steady_clock::time_point lastMoveTime;
        double totalDistance;
        int moveCount;
        bool hasFiles;

        // Trajectory analysis
        static constexpr size_t MAX_TRAJECTORY_POINTS = 100;
        std::deque<POINT> trajectory;
        int directionChanges;
        double maxVelocity;
        double avgVelocity;
    };

    DragState dragState;
    std::mutex dragStateMutex;

    static LRESULT CALLBACK MouseHookProc(int nCode, WPARAM wParam, LPARAM lParam);
    static WindowsDragMonitor* g_instance;

    // Trajectory analysis
    void AnalyzeTrajectory();
    double CalculateAngle(POINT p1, POINT p2, POINT p3);
};

Napi::FunctionReference WindowsDragMonitor::constructor;
WindowsDragMonitor* WindowsDragMonitor::g_instance = nullptr;

Napi::Object WindowsDragMonitor::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(env, "WindowsDragMonitor", {
        InstanceMethod("start", &WindowsDragMonitor::Start),
        InstanceMethod("stop", &WindowsDragMonitor::Stop),
        InstanceMethod("isMonitoring", &WindowsDragMonitor::IsMonitoring),
        InstanceMethod("hasActiveDrag", &WindowsDragMonitor::HasActiveDrag),
        InstanceMethod("getFileCount", &WindowsDragMonitor::GetFileCount),
        InstanceMethod("getDraggedFiles", &WindowsDragMonitor::GetDraggedFiles)
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("WindowsDragMonitor", func);
    return exports;
}

WindowsDragMonitor::WindowsDragMonitor(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<WindowsDragMonitor>(info),
      monitoringThread(nullptr),
      isMonitoringFlag(false),
      shouldStop(false),
      isDragging(false),
      hasActiveDragFlag(false),
      fileCount(0),
      mouseHook(nullptr),
      hookThreadId(0) {

    // Initialize drag state
    dragState.startPoint = {0, 0};
    dragState.lastPoint = {0, 0};
    dragState.startTime = std::chrono::steady_clock::now();
    dragState.lastMoveTime = std::chrono::steady_clock::now();
    dragState.totalDistance = 0;
    dragState.moveCount = 0;
    dragState.hasFiles = false;
    dragState.trajectory.clear();
    dragState.directionChanges = 0;
    dragState.maxVelocity = 0;
    dragState.avgVelocity = 0;
}

WindowsDragMonitor::~WindowsDragMonitor() {
    if (isMonitoringFlag.load()) {
        shouldStop.store(true);

        if (hookThreadId != 0) {
            PostThreadMessage(hookThreadId, WM_QUIT, 0, 0);
        }

        if (monitoringThread && monitoringThread->joinable()) {
            monitoringThread->join();
            delete monitoringThread;
            monitoringThread = nullptr;
        }

        hasActiveDragFlag.store(false);
        fileCount.store(0);
        {
            std::lock_guard<std::mutex> lock(filePathsMutex);
            draggedFilePaths.clear();
        }
    }
}

bool WindowsDragMonitor::CheckForFileDrag() {
    IDataObject* dataObject = nullptr;
    HRESULT hr = OleGetClipboard(&dataObject);

    if (FAILED(hr) || !dataObject) {
        return false;
    }

    bool hasFiles = ExtractFilesFromDataObject(dataObject);
    dataObject->Release();

    return hasFiles;
}

bool WindowsDragMonitor::ExtractFilesFromDataObject(IDataObject* dataObject) {
    FORMATETC fmt = { CF_HDROP, nullptr, DVASPECT_CONTENT, -1, TYMED_HGLOBAL };
    STGMEDIUM stg = { TYMED_HGLOBAL };

    HRESULT hr = dataObject->GetData(&fmt, &stg);
    if (FAILED(hr)) {
        return false;
    }

    HDROP hDrop = static_cast<HDROP>(GlobalLock(stg.hGlobal));
    if (!hDrop) {
        ReleaseStgMedium(&stg);
        return false;
    }

    UINT count = DragQueryFileW(hDrop, 0xFFFFFFFF, nullptr, 0);
    if (count == 0) {
        GlobalUnlock(stg.hGlobal);
        ReleaseStgMedium(&stg);
        return false;
    }

    std::lock_guard<std::mutex> lock(filePathsMutex);
    draggedFilePaths.clear();

    for (UINT i = 0; i < count; i++) {
        UINT pathLength = DragQueryFileW(hDrop, i, nullptr, 0);
        if (pathLength > 0) {
            std::wstring path(pathLength + 1, L'\0');
            DragQueryFileW(hDrop, i, &path[0], pathLength + 1);
            path.resize(pathLength); // Remove null terminator from string
            draggedFilePaths.push_back(path);
        }
    }

    fileCount.store(static_cast<int>(draggedFilePaths.size()));

    GlobalUnlock(stg.hGlobal);
    ReleaseStgMedium(&stg);

    return !draggedFilePaths.empty();
}

LRESULT CALLBACK WindowsDragMonitor::MouseHookProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0 && g_instance) {
        MSLLHOOKSTRUCT* hookData = reinterpret_cast<MSLLHOOKSTRUCT*>(lParam);

        std::lock_guard<std::mutex> lock(g_instance->dragStateMutex);
        DragState& state = g_instance->dragState;

        if (wParam == WM_LBUTTONDOWN) {
            // Potential drag start
            state.startPoint = hookData->pt;
            state.lastPoint = hookData->pt;
            state.startTime = std::chrono::steady_clock::now();
            state.lastMoveTime = std::chrono::steady_clock::now();
            state.totalDistance = 0;
            state.moveCount = 0;
            state.hasFiles = false;
            state.trajectory.clear();
            state.trajectory.push_back(hookData->pt);
            state.directionChanges = 0;
            state.maxVelocity = 0;
            state.avgVelocity = 0;
            g_instance->isDragging.store(false);
        }
        else if (wParam == WM_MOUSEMOVE && (GetAsyncKeyState(VK_LBUTTON) & 0x8000)) {
            // Dragging with left button down
            auto now = std::chrono::steady_clock::now();

            double dx = hookData->pt.x - state.lastPoint.x;
            double dy = hookData->pt.y - state.lastPoint.y;
            double moveDistance = sqrt(dx * dx + dy * dy);

            state.totalDistance += moveDistance;
            state.lastPoint = hookData->pt;
            state.moveCount++;
            state.lastMoveTime = now;

            // Add to trajectory
            state.trajectory.push_back(hookData->pt);
            if (state.trajectory.size() > DragState::MAX_TRAJECTORY_POINTS) {
                state.trajectory.pop_front();
            }

            // Calculate velocity
            auto timeDelta = std::chrono::duration_cast<std::chrono::milliseconds>(
                now - state.lastMoveTime
            ).count();
            if (timeDelta > 0) {
                double velocity = moveDistance / timeDelta;
                state.maxVelocity = (std::max)(state.maxVelocity, velocity);
                state.avgVelocity = (state.avgVelocity * (state.moveCount - 1) + velocity) / state.moveCount;
            }

            // Check for drag after minimum thresholds
            auto dragDuration = std::chrono::duration_cast<std::chrono::milliseconds>(
                now - state.startTime
            ).count();

            const double MIN_DRAG_DISTANCE = 3.0;
            const int MIN_DRAG_TIME = 10;
            const int MIN_MOVE_COUNT = 1;

            bool shouldCheckForFiles =
                state.totalDistance >= MIN_DRAG_DISTANCE &&
                dragDuration >= MIN_DRAG_TIME &&
                state.moveCount >= MIN_MOVE_COUNT;

            if (shouldCheckForFiles && !state.hasFiles && !g_instance->isDragging.load()) {
                state.hasFiles = true;
                g_instance->isDragging.store(true);

                if (g_instance->CheckForFileDrag()) {
                    g_instance->hasActiveDragFlag.store(true);
                } else {
                    g_instance->hasActiveDragFlag.store(true);
                }
            }
        }
        else if (wParam == WM_LBUTTONUP) {
            // Drag end
            bool wasDragging = g_instance->isDragging.exchange(false);

            if (wasDragging) {
                g_instance->hasActiveDragFlag.store(false);
                g_instance->fileCount.store(0);

                std::lock_guard<std::mutex> fileLock(g_instance->filePathsMutex);
                g_instance->draggedFilePaths.clear();
            }

            state.hasFiles = false;
            state.totalDistance = 0;
            state.moveCount = 0;
        }
    }

    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

Napi::Value WindowsDragMonitor::Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (isMonitoringFlag.load()) {
        return Napi::Boolean::New(env, true);
    }

    // Initialize OLE
    HRESULT hr = OleInitialize(nullptr);
    if (FAILED(hr) && hr != S_FALSE) {
        Napi::Error::New(env, "Failed to initialize OLE")
            .ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    isMonitoringFlag.store(true);
    shouldStop.store(false);
    g_instance = this;

    // Start monitoring thread
    monitoringThread = new std::thread(&WindowsDragMonitor::MonitoringLoop, this);

    return Napi::Boolean::New(env, true);
}

void WindowsDragMonitor::MonitoringLoop() {
    hookThreadId = GetCurrentThreadId();

    // Install mouse hook
    mouseHook = SetWindowsHookEx(
        WH_MOUSE_LL,
        MouseHookProc,
        GetModuleHandle(nullptr),
        0
    );

    if (!mouseHook) {
        isMonitoringFlag.store(false);
        return;
    }

    // Message pump
    MSG msg;
    while (!shouldStop.load() && GetMessage(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    // Cleanup
    if (mouseHook) {
        UnhookWindowsHookEx(mouseHook);
        mouseHook = nullptr;
    }

    isMonitoringFlag.store(false);
}

Napi::Value WindowsDragMonitor::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!isMonitoringFlag.load()) {
        return Napi::Boolean::New(env, false);
    }

    shouldStop.store(true);

    if (hookThreadId != 0) {
        PostThreadMessage(hookThreadId, WM_QUIT, 0, 0);
    }

    if (monitoringThread && monitoringThread->joinable()) {
        monitoringThread->join();
        delete monitoringThread;
        monitoringThread = nullptr;
    }

    // Cleanup state
    hasActiveDragFlag.store(false);
    fileCount.store(0);
    {
        std::lock_guard<std::mutex> lock(filePathsMutex);
        draggedFilePaths.clear();
    }

    OleUninitialize();
    g_instance = nullptr;

    return Napi::Boolean::New(env, true);
}

Napi::Value WindowsDragMonitor::IsMonitoring(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, isMonitoringFlag.load());
}

Napi::Value WindowsDragMonitor::HasActiveDrag(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, hasActiveDragFlag.load());
}

Napi::Value WindowsDragMonitor::GetFileCount(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, fileCount.load());
}

Napi::Value WindowsDragMonitor::GetDraggedFiles(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Array files = Napi::Array::New(env);

    std::lock_guard<std::mutex> lock(filePathsMutex);
    for (size_t i = 0; i < draggedFilePaths.size(); i++) {
        Napi::Object fileInfo = Napi::Object::New(env);
        const std::wstring& wpath = draggedFilePaths[i];

        // Convert wide string to UTF-8
        int size_needed = WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), -1, nullptr, 0, nullptr, nullptr);
        std::string path(size_needed - 1, '\0');
        WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), -1, &path[0], size_needed, nullptr, nullptr);

        fileInfo.Set("path", path);

        // Extract filename
        size_t lastSlash = path.find_last_of("\\/");
        std::string name = (lastSlash != std::string::npos) ? path.substr(lastSlash + 1) : path;
        fileInfo.Set("name", name);

        // Get file attributes
        DWORD attrs = GetFileAttributesW(wpath.c_str());
        bool isDirectory = (attrs != INVALID_FILE_ATTRIBUTES) && (attrs & FILE_ATTRIBUTE_DIRECTORY);
        bool exists = (attrs != INVALID_FILE_ATTRIBUTES);

        fileInfo.Set("type", isDirectory ? "folder" : "file");
        fileInfo.Set("isDirectory", isDirectory);
        fileInfo.Set("isFile", !isDirectory);
        fileInfo.Set("exists", exists);

        // Get extension
        size_t lastDot = name.find_last_of('.');
        if (lastDot != std::string::npos && !isDirectory) {
            fileInfo.Set("extension", name.substr(lastDot + 1));
        }

        // Get file size for files
        if (exists && !isDirectory) {
            WIN32_FILE_ATTRIBUTE_DATA fileData;
            if (GetFileAttributesExW(wpath.c_str(), GetFileExInfoStandard, &fileData)) {
                ULARGE_INTEGER size;
                size.LowPart = fileData.nFileSizeLow;
                size.HighPart = fileData.nFileSizeHigh;
                fileInfo.Set("size", static_cast<double>(size.QuadPart));
            }
        }

        files.Set(static_cast<uint32_t>(i), fileInfo);
    }

    return files;
}

void WindowsDragMonitor::AnalyzeTrajectory() {
    std::lock_guard<std::mutex> lock(dragStateMutex);

    if (dragState.trajectory.size() < 3) return;

    int directionChanges = 0;
    for (size_t i = 2; i < dragState.trajectory.size(); i++) {
        double angle = CalculateAngle(
            dragState.trajectory[i-2],
            dragState.trajectory[i-1],
            dragState.trajectory[i]
        );

        if (angle > M_PI / 4) {
            directionChanges++;
        }
    }

    dragState.directionChanges = directionChanges;
}

double WindowsDragMonitor::CalculateAngle(POINT p1, POINT p2, POINT p3) {
    double v1x = p2.x - p1.x;
    double v1y = p2.y - p1.y;
    double v2x = p3.x - p2.x;
    double v2y = p3.y - p2.y;

    double dot = v1x * v2x + v1y * v2y;
    double cross = v1x * v2y - v1y * v2x;

    return atan2(cross, dot);
}

// Module initialization
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return WindowsDragMonitor::Init(env, exports);
}

NODE_API_MODULE(drag_monitor_win32, InitAll)
