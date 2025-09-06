idf_component_register(
    SRCS "esp32_sensor_client.c"
    INCLUDE_DIRS "."
    REQUIRES nvs_flash wifi_provisioning esp_http_client json
)