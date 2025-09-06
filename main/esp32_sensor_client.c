#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "cJSON.h"

static const char *TAG = "SENSOR_CLIENT";

// WiFi 설정
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASS "YOUR_WIFI_PASSWORD"

// 서버 설정
#define CURRENT_SENSOR_URL "http://192.168.1.100:3000/api/current-sensor"     // 전류 센서 API
#define TEMPERATURE_SENSOR_URL "http://192.168.1.100:3000/api/temperature-sensor" // 온도 센서 API

// 센서 데이터 구조체
typedef struct {
    uint64_t timestamp;    // ESP32 타임스탬프 (ms)
    char deviceId[18];   // MAC 주소 (AA:BB:CC:DD:EE:FF)
    float sensor1;         // 센서 1 값
    float sensor2;         // 센서 2 값
    float sensor3;         // 센서 3 값
} sensor_data_t;

// WiFi 이벤트 핸들러
static void event_handler(void* arg, esp_event_base_t event_base,
                         int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        esp_wifi_connect();
        ESP_LOGI(TAG, "retry to connect to the AP");
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "got ip:" IPSTR, IP2STR(&event->ip_info.ip));
    }
}

// WiFi 초기화
void wifi_init_sta(void)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &event_handler,
                                                        NULL,
                                                        &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &event_handler,
                                                        NULL,
                                                        &instance_got_ip));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA) );
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config) );
    ESP_ERROR_CHECK(esp_wifi_start() );

    ESP_LOGI(TAG, "wifi_init_sta finished.");
}

// HTTP 응답 이벤트 핸들러
esp_err_t _http_event_handler(esp_http_client_event_t *evt)
{
    switch(evt->event_id) {
        case HTTP_EVENT_ERROR:
            ESP_LOGD(TAG, "HTTP_EVENT_ERROR");
            break;
        case HTTP_EVENT_ON_CONNECTED:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_CONNECTED");
            break;
        case HTTP_EVENT_HEADER_SENT:
            ESP_LOGD(TAG, "HTTP_EVENT_HEADER_SENT");
            break;
        case HTTP_EVENT_ON_HEADER:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_HEADER, key=%s, value=%s", evt->header_key, evt->header_value);
            break;
        case HTTP_EVENT_ON_DATA:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_DATA, len=%d", evt->data_len);
            break;
        case HTTP_EVENT_ON_FINISH:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_FINISH");
            break;
        case HTTP_EVENT_DISCONNECTED:
            ESP_LOGI(TAG, "HTTP_EVENT_DISCONNECTED");
            break;
        case HTTP_EVENT_REDIRECT:
            ESP_LOGD(TAG, "HTTP_EVENT_REDIRECT");
            break;
    }
    return ESP_OK;
}

// MAC 주소 가져오기 함수
esp_err_t get_mac_address(char *mac_str) {
    uint8_t mac[6];
    esp_err_t ret = esp_wifi_get_mac(WIFI_IF_STA, mac);
    if (ret == ESP_OK) {
        snprintf(mac_str, 18, "%02X:%02X:%02X:%02X:%02X:%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    }
    return ret;
}

// 센서 데이터를 서버로 전송
esp_err_t send_sensor_data(sensor_data_t *sensor_data, const char *api_url)
{
    // JSON 데이터 생성
    cJSON *json = cJSON_CreateObject();
    cJSON *timestamp = cJSON_CreateNumber(sensor_data->timestamp);
    cJSON *deviceId = cJSON_CreateString(sensor_data->deviceId);
    cJSON *sensor1 = cJSON_CreateNumber(sensor_data->sensor1);
    cJSON *sensor2 = cJSON_CreateNumber(sensor_data->sensor2);
    cJSON *sensor3 = cJSON_CreateNumber(sensor_data->sensor3);

    cJSON_AddItemToObject(json, "timestamp", timestamp);
    cJSON_AddItemToObject(json, "deviceId", deviceId);
    cJSON_AddItemToObject(json, "sensor1", sensor1);
    cJSON_AddItemToObject(json, "sensor2", sensor2);
    cJSON_AddItemToObject(json, "sensor3", sensor3);

    char *json_string = cJSON_Print(json);
    
    ESP_LOGI(TAG, "Sending: %s", json_string);

    // HTTP 클라이언트 설정
    esp_http_client_config_t config = {
        .url = api_url,
        .event_handler = _http_event_handler,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);

    // HTTP POST 요청 설정
    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_data(client, json_string, strlen(json_string));

    // HTTP 요청 실행
    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "HTTP POST Status = %d", status_code);
    } else {
        ESP_LOGE(TAG, "HTTP POST request failed: %s", esp_err_to_name(err));
    }

    // 메모리 정리
    esp_http_client_cleanup(client);
    free(json_string);
    cJSON_Delete(json);

    return err;
}

// ADC에서 센서 값 읽기 (예시 - 실제 센서에 맞게 수정)
float read_current_sensor(int channel)
{
    // 실제 ADC 읽기 구현 필요
    // 예시: 0-5A 범위의 랜덤 값
    return (float)(rand() % 500) / 100.0f;
}

float read_temperature_sensor(int channel)
{
    // 실제 온도 센서 읽기 구현 필요
    // 예시: 20-30°C 범위의 랜덤 값
    return 20.0f + (float)(rand() % 1000) / 100.0f;
}

// 전류 센서 데이터 전송 태스크
void current_sensor_task(void *pvParameters)
{
    sensor_data_t sensor_data;
    
    // MAC 주소 가져오기
    if (get_mac_address(sensor_data.deviceId) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to get MAC address");
        strcpy(sensor_data.deviceId, "00:00:00:00:00:00");
    }
    ESP_LOGI(TAG, "Current sensor MAC: %s", sensor_data.deviceId);

    while(1) {
        // 현재 시간을 밀리초로 가져오기
        sensor_data.timestamp = esp_timer_get_time() / 1000; // 마이크로초를 밀리초로 변환
        
        // 센서 값 읽기
        sensor_data.sensor1 = read_current_sensor(0);
        sensor_data.sensor2 = read_current_sensor(1);
        sensor_data.sensor3 = read_current_sensor(2);
        
        ESP_LOGI(TAG, "Current Sensors - S1: %.2f A, S2: %.2f A, S3: %.2f A", 
                 sensor_data.sensor1, sensor_data.sensor2, sensor_data.sensor3);
        
        // 서버로 데이터 전송 (전류 센서 API)
        send_sensor_data(&sensor_data, CURRENT_SENSOR_URL);
        
        vTaskDelay(pdMS_TO_TICKS(2000)); // 2초마다 전송
    }
}

// 온도 센서 데이터 전송 태스크
void temperature_sensor_task(void *pvParameters)
{
    sensor_data_t sensor_data;
    
    // MAC 주소 가져오기
    if (get_mac_address(sensor_data.deviceId) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to get MAC address");
        strcpy(sensor_data.deviceId, "00:00:00:00:00:01");
    }
    ESP_LOGI(TAG, "Temperature sensor MAC: %s", sensor_data.deviceId);

    while(1) {
        // 현재 시간을 밀리초로 가져오기
        sensor_data.timestamp = esp_timer_get_time() / 1000; // 마이크로초를 밀리초로 변환
        
        // 센서 값 읽기
        sensor_data.sensor1 = read_temperature_sensor(0);
        sensor_data.sensor2 = read_temperature_sensor(1);
        sensor_data.sensor3 = read_temperature_sensor(2);
        
        ESP_LOGI(TAG, "Temperature Sensors - S1: %.2f °C, S2: %.2f °C, S3: %.2f °C", 
                 sensor_data.sensor1, sensor_data.sensor2, sensor_data.sensor3);
        
        // 서버로 데이터 전송 (온도 센서 API)
        send_sensor_data(&sensor_data, TEMPERATURE_SENSOR_URL);
        
        vTaskDelay(pdMS_TO_TICKS(3000)); // 3초마다 전송
    }
}

void app_main(void)
{
    // NVS 초기화
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
      ESP_ERROR_CHECK(nvs_flash_erase());
      ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_LOGI(TAG, "ESP_WIFI_MODE_STA");
    
    // WiFi 초기화
    wifi_init_sta();
    
    // WiFi 연결 대기
    vTaskDelay(pdMS_TO_TICKS(5000));
    
    ESP_LOGI(TAG, "Starting sensor tasks...");
    
    // 디바이스 ID에 따라 해당 센서 태스크만 실행
    // 전류 센서 ESP32의 경우
    #ifdef CONFIG_CURRENT_SENSOR_DEVICE
        xTaskCreate(current_sensor_task, "current_sensor_task", 4096, NULL, 5, NULL);
    #endif
    
    // 온도 센서 ESP32의 경우  
    #ifdef CONFIG_TEMPERATURE_SENSOR_DEVICE
        xTaskCreate(temperature_sensor_task, "temperature_sensor_task", 4096, NULL, 5, NULL);
    #endif
    
    // 테스트용: 두 태스크 모두 실행
    #ifndef CONFIG_CURRENT_SENSOR_DEVICE
    #ifndef CONFIG_TEMPERATURE_SENSOR_DEVICE
        xTaskCreate(current_sensor_task, "current_sensor_task", 4096, NULL, 5, NULL);
        xTaskCreate(temperature_sensor_task, "temperature_sensor_task", 4096, NULL, 5, NULL);
    #endif
    #endif
}