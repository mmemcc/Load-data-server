const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8723;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const wss = new WebSocket.Server({ port: 8080 });

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

function createDirectoryStructure(date) {
    const [year, month] = date.split('-');
    const yearDir = path.join(dataDir, year);
    const monthDir = path.join(yearDir, month);
    
    if (!fs.existsSync(yearDir)) {
        fs.mkdirSync(yearDir, { recursive: true });
    }
    if (!fs.existsSync(monthDir)) {
        fs.mkdirSync(monthDir, { recursive: true });
    }
    
    return monthDir;
}


// 최근 데이터를 메모리에 임시 저장 (timestamp 매칭용)
const recentData = {
    current: {},
    temperature: {}
};

function writeToCSV(sensorType, macId, data) {
    const serverTimestamp = new Date().toISOString();
    const esp32Timestamp = new Date(parseInt(data.timestamp) / 1000).toISOString();
    const date = getCurrentDate();
    
    // 년/월 디렉토리 구조 생성
    const monthDir = createDirectoryStructure(date);
    
    // 파일명: yyyy-mm-dd_sensortype.csv
    const filename = `${date}_${sensorType}.csv`;
    const filepath = path.join(monthDir, filename);
    
    let csvLine, header;
    
    if (sensorType === 'temperature') {
        // 온도 센서는 devTemp, devHumi 추가
        csvLine = `${serverTimestamp},${esp32Timestamp},${macId},${data.sensor1 || -999},${data.sensor2 || -999},${data.sensor3 || -999},${data.devTemp || -999},${data.devHumi || -999}\n`;
        header = 'server_timestamp,esp32_timestamp,deviceId,sensor1,sensor2,sensor3,devTemp,devHumi\n';
    } else {
        // 전류 센서는 기존 형식
        csvLine = `${serverTimestamp},${esp32Timestamp},${macId},${data.sensor1},${data.sensor2},${data.sensor3}\n`;
        header = 'server_timestamp,esp32_timestamp,deviceId,sensor1,sensor2,sensor3\n';
    }
    
    // 헤더가 없으면 생성
    if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, header);
    }
    
    fs.appendFileSync(filepath, csvLine);
    
    // 통합 CSV 파일 작성
    writeToCombinedCSV(sensorType, macId, data, serverTimestamp, esp32Timestamp);
}

function writeToCombinedCSV(sensorType, macId, data, serverTimestamp, esp32Timestamp) {
    const date = getCurrentDate();
    const monthDir = createDirectoryStructure(date);
    const combinedFilename = `${date}_combined.csv`;
    const combinedFilepath = path.join(monthDir, combinedFilename);
    
    // 현재 timestamp를 기준으로 데이터 저장
    const timestampKey = data.timestamp.toString();
    
    if (sensorType === 'temperature') {
        recentData.temperature[timestampKey] = {
            serverTimestamp,
            esp32Timestamp,
            deviceId: macId,
            temp1: data.sensor1 || -999,
            temp2: data.sensor2 || -999,
            temp3: data.sensor3 || -999,
            devTemp: data.devTemp || -999,
            devHumi: data.devHumi || -999
        };
    } else {
        recentData.current[timestampKey] = {
            serverTimestamp,
            esp32Timestamp,
            deviceId: macId,
            current1: data.sensor1 || -999,
            current2: data.sensor2 || -999,
            current3: data.sensor3 || -999
        };
    }
    
    // 매칭되는 timestamp 찾기 (±1초 이내)
    const tolerance = 1000000; // 1초 in microseconds
    let matchFound = false;
    
    if (sensorType === 'temperature') {
        // 온도 데이터가 들어왔을 때 전류 데이터 확인
        for (const currentKey in recentData.current) {
            if (Math.abs(parseInt(currentKey) - parseInt(timestampKey)) <= tolerance) {
                const currentData = recentData.current[currentKey];
                const tempData = recentData.temperature[timestampKey];
                
                const header = 'server_timestamp,esp32_timestamp,temp_deviceId,current_deviceId,temp1,temp2,temp3,current1,current2,current3,devTemp,devHumi\n';
                const csvLine = `${tempData.serverTimestamp},${tempData.esp32Timestamp},${tempData.deviceId},${currentData.deviceId},${tempData.temp1},${tempData.temp2},${tempData.temp3},${currentData.current1},${currentData.current2},${currentData.current3},${tempData.devTemp},${tempData.devHumi}\n`;
                
                if (!fs.existsSync(combinedFilepath)) {
                    fs.writeFileSync(combinedFilepath, header);
                }
                fs.appendFileSync(combinedFilepath, csvLine);
                
                // 매칭된 데이터 제거
                delete recentData.current[currentKey];
                delete recentData.temperature[timestampKey];
                matchFound = true;
                break;
            }
        }
    } else {
        // 전류 데이터가 들어왔을 때 온도 데이터 확인
        for (const tempKey in recentData.temperature) {
            if (Math.abs(parseInt(tempKey) - parseInt(timestampKey)) <= tolerance) {
                const tempData = recentData.temperature[tempKey];
                const currentData = recentData.current[timestampKey];
                
                const header = 'server_timestamp,esp32_timestamp,temp_deviceId,current_deviceId,temp1,temp2,temp3,current1,current2,current3,devTemp,devHumi\n';
                const csvLine = `${tempData.serverTimestamp},${tempData.esp32Timestamp},${tempData.deviceId},${currentData.deviceId},${tempData.temp1},${tempData.temp2},${tempData.temp3},${currentData.current1},${currentData.current2},${currentData.current3},${tempData.devTemp},${tempData.devHumi}\n`;
                
                if (!fs.existsSync(combinedFilepath)) {
                    fs.writeFileSync(combinedFilepath, header);
                }
                fs.appendFileSync(combinedFilepath, csvLine);
                
                // 매칭된 데이터 제거
                delete recentData.temperature[tempKey];
                delete recentData.current[timestampKey];
                matchFound = true;
                break;
            }
        }
    }
    
    // 오래된 데이터 정리 (10초 이상 된 데이터)
    const currentTime = parseInt(timestampKey);
    const maxAge = 10000000; // 10초 in microseconds
    
    for (const key in recentData.current) {
        if (currentTime - parseInt(key) > maxAge) {
            delete recentData.current[key];
        }
    }
    
    for (const key in recentData.temperature) {
        if (currentTime - parseInt(key) > maxAge) {
            delete recentData.temperature[key];
        }
    }
}

function broadcastToClients(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// 전류 센서 전용 엔드포인트
app.post('/api/current-sensor', (req, res) => {
    try {
        const data = req.body;
        console.log('Received current sensor data:', data);
        
        const macId = data.deviceId;
        const sensorType = 'current';
        
        // 년/월/일 디렉토리에 MAC 주소별 파일로 저장
        writeToCSV(sensorType, macId, data);
        
        const broadcastData = {
            type: sensorType,
            timestamp: data.timestamp || new Date().toISOString(),
            deviceId: macId,
            data: {
                sensor1: data.sensor1,
                sensor2: data.sensor2,
                sensor3: data.sensor3
            }
        };
        broadcastToClients(broadcastData);
        
        res.json({ 
            status: 'success', 
            message: 'Current sensor data received',
            sensorType: sensorType,
            deviceId: macId
        });
    } catch (error) {
        console.error('Error processing current sensor data:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 온도 센서 전용 엔드포인트
app.post('/api/temperature-sensor', (req, res) => {
    try {
        const data = req.body;
        console.log('Received temperature sensor data:', data);
        
        const macId = data.deviceId;
        const sensorType = 'temperature';
        
        // 년/월/일 디렉토리에 MAC 주소별 파일로 저장
        writeToCSV(sensorType, macId, data);
        
        const broadcastData = {
            type: sensorType,
            timestamp: data.timestamp || new Date().toISOString(),
            deviceId: macId,
            data: {
                sensor1: data.sensor1,
                sensor2: data.sensor2,
                sensor3: data.sensor3,
                devTemp: data.devTemp,
                devHumi: data.devHumi
            }
        };
        broadcastToClients(broadcastData);
        
        res.json({ 
            status: 'success', 
            message: 'Temperature sensor data received',
            sensorType: sensorType,
            deviceId: macId
        });
    } catch (error) {
        console.error('Error processing temperature sensor data:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// CSV 다운로드 전용 엔드포인트
app.get('/api/download-csv', (req, res) => {
    try {
        const { date, type } = req.query;
        const targetDate = date || getCurrentDate();
        const [year, month] = targetDate.split('-');
        const monthDir = path.join(dataDir, year, month);
        
        if (!type) {
            return res.status(400).send('Type parameter is required');
        }
        
        // 통합 CSV 다운로드
        if (type === 'combined') {
            const filename = `${targetDate}_combined.csv`;
            const filepath = path.join(monthDir, filename);
            
            if (fs.existsSync(filepath)) {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                const fileStream = fs.createReadStream(filepath);
                fileStream.pipe(res);
            } else {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                const header = 'server_timestamp,esp32_timestamp,temp_deviceId,current_deviceId,temp1,temp2,temp3,current1,current2,current3,devTemp,devHumi\n';
                res.send(header);
            }
            return;
        }
        
        const filename = `${targetDate}_${type}.csv`;
        const filepath = path.join(monthDir, filename);
        
        if (fs.existsSync(filepath)) {
            // CSV 파일 직접 전송
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            const fileStream = fs.createReadStream(filepath);
            fileStream.pipe(res);
        } else {
            // 파일이 없으면 빈 CSV 생성
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            // 헤더만 있는 빈 CSV 전송
            const header = type === 'temperature' 
                ? 'serverTimestamp,esp32Timestamp,deviceId,sensor1,sensor2,sensor3,devTemp,devHumi\n'
                : 'serverTimestamp,esp32Timestamp,deviceId,sensor1,sensor2,sensor3\n';
            res.send(header);
        }
    } catch (error) {
        console.error('Error downloading CSV:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 데이터가 있는 날짜 목록 반환
app.get('/api/available-dates', (req, res) => {
    try {
        const availableDates = new Set();
        
        // 연도 디렉토리 스캔
        if (fs.existsSync(dataDir)) {
            const years = fs.readdirSync(dataDir).filter(year => {
                const yearPath = path.join(dataDir, year);
                return fs.statSync(yearPath).isDirectory();
            });
            
            years.forEach(year => {
                const yearPath = path.join(dataDir, year);
                const months = fs.readdirSync(yearPath).filter(month => {
                    const monthPath = path.join(yearPath, month);
                    return fs.statSync(monthPath).isDirectory();
                });
                
                months.forEach(month => {
                    const monthPath = path.join(yearPath, month);
                    const files = fs.readdirSync(monthPath);
                    
                    files.forEach(file => {
                        // CSV 파일명에서 날짜 추출 (예: 2025-09-06_current.csv, 2025-09-06_combined.csv)
                        const match = file.match(/^(\d{4}-\d{2}-\d{2})_(current|temperature|combined)\.csv$/);
                        if (match) {
                            availableDates.add(match[1]);
                        }
                    });
                });
            });
        }
        
        // 날짜를 배열로 변환하고 정렬 (최신 날짜가 먼저)
        const sortedDates = Array.from(availableDates).sort().reverse();
        
        res.json({ dates: sortedDates });
    } catch (error) {
        console.error('Error getting available dates:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/data-history', (req, res) => {
    try {
        const { deviceId, date, type } = req.query;
        const targetDate = date || getCurrentDate();
        const [year, month] = targetDate.split('-');
        const monthDir = path.join(dataDir, year, month);
        
        let data = [];
        
        if (type) {
            // 특정 센서 타입 데이터 조회
            const filename = `${targetDate}_${type}.csv`;
            const filepath = path.join(monthDir, filename);
            
            if (fs.existsSync(filepath)) {
                const csvData = fs.readFileSync(filepath, 'utf8');
                const lines = csvData.trim().split('\n');
                data = lines.slice(1).map(line => {
                    const values = line.split(',');
                    return {
                        serverTimestamp: values[0],
                        esp32Timestamp: values[1],
                        deviceId: values[2],
                        sensor1: parseFloat(values[3]),
                        sensor2: parseFloat(values[4]),
                        sensor3: parseFloat(values[5])
                    };
                });
                
                // MAC 주소로 필터링 (요청된 경우)
                if (deviceId) {
                    data = data.filter(item => item.deviceId === deviceId);
                }
            }
        } else {
            // 모든 센서 타입 데이터 조회
            if (fs.existsSync(monthDir)) {
                const sensorTypes = ['current', 'temperature'];
                
                sensorTypes.forEach(sensorType => {
                    const filename = `${targetDate}_${sensorType}.csv`;
                    const filepath = path.join(monthDir, filename);
                    
                    if (fs.existsSync(filepath)) {
                        const csvData = fs.readFileSync(filepath, 'utf8');
                        const lines = csvData.trim().split('\n');
                        const fileData = lines.slice(1).map(line => {
                            const values = line.split(',');
                            return {
                                serverTimestamp: values[0],
                                esp32Timestamp: values[1],
                                deviceId: values[2],
                                sensor1: parseFloat(values[3]),
                                sensor2: parseFloat(values[4]),
                                sensor3: parseFloat(values[5]),
                                sensorType: sensorType
                            };
                        });
                        data = data.concat(fileData);
                    }
                });
                
                // MAC 주소로 필터링 (요청된 경우)
                if (deviceId) {
                    data = data.filter(item => item.deviceId === deviceId);
                }
                
                // 시간순 정렬
                data.sort((a, b) => new Date(a.serverTimestamp) - new Date(b.serverTimestamp));
            }
        }
        
        res.json({ data });
    } catch (error) {
        console.error('Error reading data history:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`WebSocket server running at ws://localhost:8080`);
});