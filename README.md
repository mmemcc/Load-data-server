# ESP32 센서 데이터 수집 서버

ESP32 두 대에서 센서 데이터를 수집하여 CSV 파일로 저장하고 실시간 웹 대시보드로 모니터링하는 Node.js 서버입니다.

## 기능

- **실시간 데이터 수집**: ESP32에서 HTTP POST로 전송되는 센서 데이터 수신
- **CSV 파일 저장**: 날짜별로 분리된 CSV 파일로 데이터 저장
- **실시간 대시보드**: WebSocket을 통한 실시간 그래프 표시
- **데이터 내역 조회**: 과거 데이터 조회 및 다운로드 기능

## 하드웨어 구성

- **ESP32 #1**: 전류 센서 3개 (센서1, 센서2, 센서3)
- **ESP32 #2**: 온도 센서 3개 (센서1, 센서2, 센서3)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 서버 시작
npm start

# 개발 모드 실행
npm run dev

# 테스트 데이터 전송
npm test
```

## API 엔드포인트

### POST /api/sensor-data (권장)
모든 센서 데이터 수신 - 새로운 형식

**요청 형식:**
```json
{
  "timestamp": 1725590123456,
  "deviceId": "CURR_ESP32_01",
  "sensor1": 2.34,
  "sensor2": 1.78,
  "sensor3": 3.12
}
```

### POST /api/current-data (호환성용)
전류 센서 데이터 수신

**요청 형식:**
```json
{
  "sensor1": 2.34,
  "sensor2": 1.78,
  "sensor3": 3.12
}
```

### POST /api/temperature-data (호환성용)
온도 센서 데이터 수신

**요청 형식:**
```json
{
  "sensor1": 25.6,
  "sensor2": 24.3,
  "sensor3": 26.1
}
```

### GET /api/data-history
저장된 데이터 조회

**파라미터:**
- `type`: "current" 또는 "temperature"
- `date`: "YYYY-MM-DD" 형식 (옵션, 기본값: 오늘)

**예시:** `/api/data-history?type=current&date=2025-09-06`

## 웹 대시보드

브라우저에서 `http://localhost:3000`로 접속하면 실시간 대시보드를 볼 수 있습니다.

### 대시보드 기능
- **실시간 그래프**: Chart.js를 사용한 6개 센서의 실시간 라인 차트
- **현재 값 표시**: 각 센서의 최신 측정값
- **데이터 테이블**: 최근 20개 데이터 포인트 표시
- **날짜별 조회**: 과거 데이터 조회
- **CSV 다운로드**: 선택한 날짜의 CSV 파일 다운로드
- **데이터 초기화**: 실시간 그래프 데이터 클리어

## 데이터 저장

### CSV 파일 형식 (새로운 형식)
```csv
server_timestamp,esp32_timestamp,device_id,sensor1,sensor2,sensor3
2025-09-06T03:24:43.971Z,2025-09-06T03:24:43.960Z,CURR_ESP32_01,2.35,1.00,2.59
2025-09-06T03:24:43.973Z,2025-09-06T03:24:44.060Z,TEMP_ESP32_02,21.79,22.25,26.50
```

### CSV 파일 형식 (기존 호환성)
```csv
timestamp,sensor1,sensor2,sensor3
2025-09-06T03:11:08.716Z,4.75,1.70,2.00
2025-09-06T03:11:10.708Z,2.66,3.31,4.60
```

### 파일 경로
- 전류 데이터: `data/current_data_YYYY-MM-DD.csv`
- 온도 데이터: `data/temperature_data_YYYY-MM-DD.csv`

## ESP32 설정

### 새로운 형식 (권장)
ESP-IDF를 사용한 구조체 기반 데이터 전송:

```c
// 센서 데이터 구조체
typedef struct {
    uint64_t timestamp;    // ESP32 타임스탬프 (ms)
    char deviceId[13];     // 디바이스 ID
    float sensor1;         // 센서 1 값
    float sensor2;         // 센서 2 값
    float sensor3;         // 센서 3 값
} sensor_data_t;

// JSON 데이터 생성 및 전송
cJSON *json = cJSON_CreateObject();
cJSON_AddItemToObject(json, "timestamp", cJSON_CreateNumber(sensor_data.timestamp));
cJSON_AddItemToObject(json, "deviceId", cJSON_CreateString(sensor_data.deviceId));
cJSON_AddItemToObject(json, "sensor1", cJSON_CreateNumber(sensor_data.sensor1));
cJSON_AddItemToObject(json, "sensor2", cJSON_CreateNumber(sensor_data.sensor2));
cJSON_AddItemToObject(json, "sensor3", cJSON_CreateNumber(sensor_data.sensor3));
char *json_string = cJSON_Print(json);

// HTTP POST 전송
esp_http_client_set_url(client, "http://[서버IP]:3000/api/sensor-data");
esp_http_client_set_post_data(client, json_string, strlen(json_string));
```

전체 ESP-IDF 예제 코드는 `main/esp32_sensor_client.c` 파일을 참고하세요.

### 기존 형식 (호환성용)
Arduino IDE를 사용한 간단한 형식:

```cpp
// 전류 센서 데이터 전송
http.begin("http://[서버IP]:3000/api/current-data");
http.addHeader("Content-Type", "application/json");
String payload = "{\"sensor1\":2.34,\"sensor2\":1.78,\"sensor3\":3.12}";
http.POST(payload);

// 온도 센서 데이터 전송  
http.begin("http://[서버IP]:3000/api/temperature-data");
http.addHeader("Content-Type", "application/json");
String payload = "{\"sensor1\":25.6,\"sensor2\":24.3,\"sensor3\":26.1}";
http.POST(payload);
```

## 네트워크 설정

- **HTTP 서버**: 포트 3000
- **WebSocket 서버**: 포트 8080
- ESP32와 서버는 같은 WiFi 네트워크에 연결되어야 합니다

## 파일 구조

```
/
├── server.js              # 메인 서버 파일
├── test_esp32_data.js     # 테스트 데이터 전송 스크립트
├── package.json           # 프로젝트 설정
├── public/               # 웹 대시보드 파일
│   ├── index.html        # 대시보드 HTML
│   ├── style.css         # 스타일시트
│   └── script.js         # 클라이언트 JavaScript
├── data/                 # CSV 데이터 저장 디렉토리
└── README.md            # 이 파일
```

## 문제 해결

### 연결 오류
- ESP32와 서버가 같은 네트워크에 있는지 확인
- 서버 IP 주소가 정확한지 확인
- 방화벽 설정 확인

### 데이터 미수신
- ESP32의 HTTP 요청 형식이 올바른지 확인
- JSON 형식이 정확한지 확인
- 서버 콘솔 로그 확인