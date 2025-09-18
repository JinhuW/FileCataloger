/**
 * @file napi_smart_ptr.h
 * @brief Smart pointer utilities for N-API threadsafe function data
 *
 * This header provides utilities to safely manage memory when passing
 * data through N-API threadsafe functions while maintaining RAII principles.
 */

#ifndef NATIVE_COMMON_NAPI_SMART_PTR_H
#define NATIVE_COMMON_NAPI_SMART_PTR_H

#include <memory>
#include <node_api.h>

namespace FileCataloger {

/**
 * Wrapper for data passed through N-API threadsafe functions
 *
 * This class ensures proper memory management while working with
 * N-API's C-style callback system that expects raw pointers.
 */
template<typename T>
class NapiDataWrapper {
public:
    explicit NapiDataWrapper(std::unique_ptr<T> data)
        : data_(std::move(data)) {}

    // Get raw pointer for N-API (ownership remains with wrapper)
    T* get() { return data_.get(); }

    // Release ownership (for when N-API callback will delete)
    T* release() { return data_.release(); }

    // Check if data is valid
    bool valid() const { return data_ != nullptr; }

private:
    std::unique_ptr<T> data_;
};

/**
 * Helper function to create wrapped data
 */
template<typename T, typename... Args>
std::unique_ptr<NapiDataWrapper<T>> MakeNapiData(Args&&... args) {
    auto data = std::make_unique<T>(std::forward<Args>(args)...);
    return std::make_unique<NapiDataWrapper<T>>(std::move(data));
}

/**
 * RAII wrapper for N-API threadsafe function calls
 * Ensures data is deleted even if the call fails
 */
template<typename T>
class ThreadsafeFunctionCall {
public:
    ThreadsafeFunctionCall(napi_threadsafe_function tsfn, std::unique_ptr<T> data)
        : tsfn_(tsfn), data_(std::move(data)) {}

    napi_status Call(napi_threadsafe_function_call_mode mode = napi_tsfn_nonblocking) {
        if (!data_) {
            return napi_invalid_arg;
        }

        // Release ownership to N-API callback
        T* raw_data = data_.release();
        napi_status status = napi_call_threadsafe_function(tsfn_, raw_data, mode);

        // If call failed, we need to clean up
        if (status != napi_ok) {
            delete raw_data;
        }

        return status;
    }

private:
    napi_threadsafe_function tsfn_;
    std::unique_ptr<T> data_;
};

} // namespace FileCataloger

#endif // NATIVE_COMMON_NAPI_SMART_PTR_H