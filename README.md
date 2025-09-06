# ESP32 센서 데이터 수집 서버

ESP32에서 전송하는 전류 및 온도 센서 데이터를 수집하고 실시간으로 모니터링하는 Node.js 서버입니다.

## 주요 기능

### 1. 데이터 수집
- **전류 센서 데이터**: 3개 센서의 전류값 수집 (current1, current2, current3)
- **온도 센서 데이터**: 3개 센서의 온도값 (temp1, temp2, temp3) + 디바이스 환경 센서 (devTemp, devHumi) 수집
- **자동 통합 저장**: timestamp가 1초 이내로 일치하는 전류/온도 데이터를 자동으로 매칭하여 통합 CSV 저장

### 2. 실시간 모니터링
- **WebSocket 통신**: 포트 8080을 통한 실시간 데이터 스트리밍
- **실시간 차트**: Chart.js를 사용한 개별 센서별 실시간 그래프 (최대 50개 데이터 포인트)
- **대시보드 레이아웃**: 
  - 3행 2열 그리드 (각 센서별로 온도/전류 나란히 표시)
  - 디바이스 환경 센서 (온도/습도) 상단에 별도 표시
  - MAC 주소 정보 표시

### 3. 데이터 저장
- **계층적 디렉토리 구조**: `data/년도/월/YYYY-MM-DD_타입.csv` 형식
- **3가지 CSV 파일 형식**:
  - `YYYY-MM-DD_current.csv`: 전류 데이터만
  - `YYYY-MM-DD_temperature.csv`: 온도 데이터만  
  - `YYYY-MM-DD_combined.csv`: timestamp 매칭된 통합 데이터
- **CSV 헤더 형식**:
  - 통합: `server_timestamp, esp32_timestamp, temp_deviceId, current_deviceId, temp1, temp2, temp3, current1, current2, current3, devTemp, devHumi`
  - 전류: `server_timestamp, esp32_timestamp, deviceId, sensor1, sensor2, sensor3`
  - 온도: `server_timestamp, esp32_timestamp, deviceId, sensor1, sensor2, sensor3, devTemp, devHumi`

### 4. 데이터 다운로드
- **날짜 선택기**: 실제 데이터가 있는 날짜만 드롭다운에 표시
- **3가지 다운로드 옵션**:
  - 통합 CSV 다운로드 (timestamp 매칭된 데이터)
  - 전류 CSV 다운로드
  - 온도 CSV 다운로드

## 설치 및 실행

### 필수 요구사항
- Node.js 14.0 이상
- npm 또는 yarn

### 설치
```bash
npm install
```

### 실행
```bash
node server.js
```

### 서버 포트
- HTTP 서버: `http://localhost:8723`
- WebSocket: `ws://localhost:8080`

## API 엔드포인트

### 데이터 수신
- `POST /api/current-sensor`: 전류 센서 데이터 수신
- `POST /api/temperature-sensor`: 온도 센서 데이터 수신

### 데이터 조회 및 다운로드
- `GET /api/data-history`: JSON 형식으로 과거 데이터 조회
  - 파라미터: `?type=current&date=YYYY-MM-DD`
- `GET /api/available-dates`: 데이터가 있는 날짜 목록 조회
- `GET /api/download-csv`: CSV 파일 다운로드
  - `?type=current&date=YYYY-MM-DD`: 전류 데이터
  - `?type=temperature&date=YYYY-MM-DD`: 온도 데이터
  - `?type=combined&date=YYYY-MM-DD`: 통합 데이터

## ESP32 데이터 형식

### 전류 센서 요청
```json
{
  "timestamp": 1757138384115106,
  "deviceId": "8CBFEA879230",
  "sensor1": 11.234,
  "sensor2": 11.345,
  "sensor3": 11.256
}
```

### 온도 센서 요청
```json
{
  "timestamp": 1757138384115106,
  "deviceId": "1020BA593DC0",
  "sensor1": 25.5,
  "sensor2": 26.0,
  "sensor3": 24.8,
  "devTemp": 26.38,
  "devHumi": 42.04
}
```

## 디렉토리 구조
```
Load-data server/
├── server.js           # 메인 서버 파일
├── package.json        # 프로젝트 설정
├── public/
│   ├── index.html     # 대시보드 페이지
│   ├── style.css      # 스타일시트
│   └── script.js      # 클라이언트 JavaScript
└── data/              # CSV 데이터 저장 디렉토리
    └── 2025/
        └── 09/
            ├── 2025-09-06_current.csv
            ├── 2025-09-06_temperature.csv
            └── 2025-09-06_combined.csv
```

## 주요 설정

### Timestamp 매칭
- 전류와 온도 데이터를 통합할 때 1초(1,000,000 마이크로초) 이내의 timestamp만 매칭
- 매칭되지 않은 10초 이상 오래된 데이터는 자동 정리
- ESP32의 마이크로초 단위 timestamp 사용

### 차트 설정
- 최대 데이터 포인트: 50개
- 실시간 업데이트 애니메이션 비활성화 (성능 최적화)
- 개별 센서별 독립 차트 (총 8개 차트: 전류 3개, 온도 3개, 디바이스 온도 1개, 디바이스 습도 1개)

### 웹 대시보드 기능
- **실시간 값 표시**: 각 센서의 최신 측정값 실시간 업데이트
- **데이터 테이블**: 최근 20개 데이터 포인트 표시
- **날짜별 조회**: 과거 데이터 로드 및 차트 표시
- **데이터 초기화**: 실시간 그래프 데이터 클리어
- **반응형 디자인**: 모바일 기기 지원

## ESP32 설정 예시

### Arduino IDE 사용
```cpp
// 전류 센서 데이터 전송
HTTPClient http;
http.begin("http://[서버IP]:8723/api/current-sensor");
http.addHeader("Content-Type", "application/json");

StaticJsonDocument<200> doc;
doc["timestamp"] = esp_timer_get_time();  // 마이크로초 단위
doc["deviceId"] = WiFi.macAddress();
doc["sensor1"] = current1;
doc["sensor2"] = current2;
doc["sensor3"] = current3;

String payload;
serializeJson(doc, payload);
http.POST(payload);
```

### 온도 센서 (환경 센서 포함)
```cpp
// 온도 센서 데이터 전송
doc["timestamp"] = esp_timer_get_time();
doc["deviceId"] = WiFi.macAddress();
doc["sensor1"] = temp1;
doc["sensor2"] = temp2;
doc["sensor3"] = temp3;
doc["devTemp"] = deviceTemp;    // 디바이스 온도
doc["devHumi"] = deviceHumi;    // 디바이스 습도
```

## 문제 해결

### 데이터가 표시되지 않을 때
1. ESP32의 timestamp가 마이크로초 단위인지 확인
2. deviceId (MAC 주소) 필드가 포함되어 있는지 확인
3. WebSocket 연결 상태 확인 (포트 8080)
4. 브라우저 콘솔에서 에러 메시지 확인

### 통합 CSV에 데이터가 없을 때
1. 전류와 온도 데이터의 timestamp 차이가 1초 이내인지 확인
2. 두 ESP32의 시간 동기화 상태 확인
3. 서버 로그에서 매칭 실패 원인 확인

### CSV 다운로드 문제
1. 날짜 선택기에서 데이터가 있는 날짜 선택 확인
2. 브라우저 다운로드 설정 확인
3. 파일 권한 문제 확인

## 네트워크 설정
- ESP32와 서버는 같은 네트워크에 연결되어야 함
- 방화벽에서 포트 8723, 8080 허용 필요
- 서버 IP 주소 고정 권장

## 라이센스
MIT