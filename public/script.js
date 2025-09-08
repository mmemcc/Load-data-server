let ws;
let sensor1TempChart;
let sensor2TempChart;
let sensor3TempChart;
let sensor1CurrentChart;
let sensor2CurrentChart;
let sensor3CurrentChart;
let deviceTempChart;
let deviceHumiChart;
let recentData = [];
const maxDataPoints = 50;

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
        }
    },
    scales: {
        x: {
            title: {
                display: true,
                text: '시간'
            }
        },
        y: {
            beginAtZero: true,
            title: {
                display: true,
                text: '값'
            }
        }
    },
    animation: {
        duration: 0
    }
};

function initCharts() {
    // 전류 차트들 (1행)
    const sensor1CurrentCtx = document.getElementById('sensor1CurrentChart').getContext('2d');
    const sensor2CurrentCtx = document.getElementById('sensor2CurrentChart').getContext('2d');
    const sensor3CurrentCtx = document.getElementById('sensor3CurrentChart').getContext('2d');
    
    // 온도 차트들 (2행)
    const sensor1TempCtx = document.getElementById('sensor1TempChart').getContext('2d');
    const sensor2TempCtx = document.getElementById('sensor2TempChart').getContext('2d');
    const sensor3TempCtx = document.getElementById('sensor3TempChart').getContext('2d');
    
    // Device 환경 센서 차트들
    const deviceTempCtx = document.getElementById('deviceTempChart').getContext('2d');
    const deviceHumiCtx = document.getElementById('deviceHumiChart').getContext('2d');
    
    // 온도 차트 옵션
    const tempChartOptions = {
        ...chartOptions,
        scales: {
            ...chartOptions.scales,
            y: {
                ...chartOptions.scales.y,
                title: {
                    display: true,
                    text: '온도 (°C)'
                }
            }
        }
    };
    
    // 전류 차트 옵션
    const currentChartOptions = {
        ...chartOptions,
        scales: {
            ...chartOptions.scales,
            y: {
                ...chartOptions.scales.y,
                title: {
                    display: true,
                    text: '전류 (A)'
                }
            }
        }
    };
    
    // 센서 1 전류 차트
    sensor1CurrentChart = new Chart(sensor1CurrentCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '전류 (A)',
                data: [],
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                tension: 0.1
            }]
        },
        options: currentChartOptions
    });
    
    // 센서 2 전류 차트
    sensor2CurrentChart = new Chart(sensor2CurrentCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '전류 (A)',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.1
            }]
        },
        options: currentChartOptions
    });
    
    // 센서 3 전류 차트
    sensor3CurrentChart = new Chart(sensor3CurrentCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '전류 (A)',
                data: [],
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                tension: 0.1
            }]
        },
        options: currentChartOptions
    });
    
    // 센서 1 온도 차트
    sensor1TempChart = new Chart(sensor1TempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '온도 (°C)',
                data: [],
                borderColor: '#f39c12',
                backgroundColor: 'rgba(243, 156, 18, 0.1)',
                tension: 0.1
            }]
        },
        options: tempChartOptions
    });
    
    // 센서 2 온도 차트
    sensor2TempChart = new Chart(sensor2TempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '온도 (°C)',
                data: [],
                borderColor: '#9b59b6',
                backgroundColor: 'rgba(155, 89, 182, 0.1)',
                tension: 0.1
            }]
        },
        options: tempChartOptions
    });
    
    // 센서 3 온도 차트
    sensor3TempChart = new Chart(sensor3TempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '온도 (°C)',
                data: [],
                borderColor: '#e67e22',
                backgroundColor: 'rgba(230, 126, 34, 0.1)',
                tension: 0.1
            }]
        },
        options: tempChartOptions
    });

    // Device 온도 차트
    deviceTempChart = new Chart(deviceTempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Device 온도',
                data: [],
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                tension: 0.1
            }]
        },
        options: {
            ...chartOptions,
            scales: {
                ...chartOptions.scales,
                y: {
                    ...chartOptions.scales.y,
                    title: {
                        display: true,
                        text: '온도 (°C)'
                    }
                }
            }
        }
    });

    // Device 습도 차트
    deviceHumiChart = new Chart(deviceHumiCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Device 습도',
                data: [],
                borderColor: '#4ecdc4',
                backgroundColor: 'rgba(78, 205, 196, 0.1)',
                tension: 0.1
            }]
        },
        options: {
            ...chartOptions,
            scales: {
                ...chartOptions.scales,
                y: {
                    ...chartOptions.scales.y,
                    title: {
                        display: true,
                        text: '습도 (%)'
                    }
                }
            }
        }
    });
}

function connectWebSocket() {
    const status = document.getElementById('connectionStatus');
    status.textContent = '연결 중...';
    status.className = 'status connecting';
    
    // 현재 페이지의 호스트를 사용하여 WebSocket 연결
    const wsUrl = `ws://${window.location.hostname}:8080`;
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        console.log('WebSocket 연결됨');
        status.textContent = '연결됨';
        status.className = 'status connected';
    };
    
    ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        handleSensorData(message);
    };
    
    ws.onclose = function() {
        console.log('WebSocket 연결 끊어짐');
        status.textContent = '연결 끊어짐';
        status.className = 'status disconnected';
        
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket 오류:', error);
        status.textContent = '연결 오류';
        status.className = 'status disconnected';
    };
}

function handleSensorData(message) {
    const { type, timestamp, deviceId, data } = message;
    // ESP32에서 받은 timestamp는 마이크로초(μs) 단위이므로 밀리초(ms)로 변환
    const time = new Date(timestamp / 1000);
    
    updateCurrentValues(type, data, deviceId);
    
    addToChart(type, time, data);
    
    addToRecentData(type, timestamp, data, deviceId);
    
    updateDataTable();
}

function updateCurrentValues(type, data, deviceId) {
    const prefix = type === 'current' ? 'current' : 'temp';
    
    document.getElementById(`${prefix}-sensor1`).textContent = data.sensor1.toFixed(2);
    document.getElementById(`${prefix}-sensor2`).textContent = data.sensor2.toFixed(2);
    document.getElementById(`${prefix}-sensor3`).textContent = data.sensor3.toFixed(2);
    
    // 온도 센서의 경우 devTemp, devHumi 값도 업데이트
    if (type === 'temperature' && data.devTemp !== undefined && data.devHumi !== undefined) {
        document.getElementById('temp-devTemp').textContent = data.devTemp.toFixed(2);
        document.getElementById('temp-devHumi').textContent = data.devHumi.toFixed(2);
        
        // Device 환경 센서의 MAC 주소도 업데이트
        document.getElementById('device-env-device').textContent = deviceId || '--';
    }
    
    // MAC 주소 표시 업데이트
    const deviceElement = document.getElementById(`${prefix}-device`);
    if (deviceElement) {
        deviceElement.textContent = deviceId || '--';
    }
}

function addToChart(type, time, data) {
    const timeLabel = time.toLocaleTimeString('ko-KR');
    
    if (type === 'current') {
        // 전류 센서 데이터를 각각의 전류 차트에 추가
        addDataToChart(sensor1CurrentChart, timeLabel, data.sensor1);
        addDataToChart(sensor2CurrentChart, timeLabel, data.sensor2);
        addDataToChart(sensor3CurrentChart, timeLabel, data.sensor3);
    } else if (type === 'temperature') {
        // 온도 센서 데이터를 각각의 온도 차트에 추가
        addDataToChart(sensor1TempChart, timeLabel, data.sensor1);
        addDataToChart(sensor2TempChart, timeLabel, data.sensor2);
        addDataToChart(sensor3TempChart, timeLabel, data.sensor3);
        
        // Device 온도/습도 차트 업데이트
        if (data.devTemp !== undefined && data.devHumi !== undefined) {
            // Device 온도 차트 업데이트
            addDataToChart(deviceTempChart, timeLabel, data.devTemp);
            
            // Device 습도 차트 업데이트
            addDataToChart(deviceHumiChart, timeLabel, data.devHumi);
        }
    }
}

function addDataToChart(chart, timeLabel, value) {
    chart.data.labels.push(timeLabel);
    chart.data.datasets[0].data.push(value);
    
    // 최대 데이터 포인트 제한
    if (chart.data.labels.length > maxDataPoints) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    
    chart.update('none');
}

function addToRecentData(type, timestamp, data, deviceId) {
    recentData.unshift({
        timestamp: new Date(timestamp / 1000).toLocaleString('ko-KR'),
        type: type === 'current' ? '전류' : '온도',
        macAddress: deviceId || 'N/A',
        sensor1: data.sensor1.toFixed(2),
        sensor2: data.sensor2.toFixed(2),
        sensor3: data.sensor3.toFixed(2),
        devTemp: data.devTemp ? data.devTemp.toFixed(2) : '--',
        devHumi: data.devHumi ? data.devHumi.toFixed(2) : '--'
    });
    
    if (recentData.length > 20) {
        recentData.pop();
    }
}

function updateDataTable() {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';
    
    recentData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.timestamp}</td>
            <td>${row.type}</td>
            <td>${row.macAddress}</td>
            <td>${row.sensor1}</td>
            <td>${row.sensor2}</td>
            <td>${row.sensor3}</td>
            <td>${row.devTemp}</td>
            <td>${row.devHumi}</td>
        `;
        tbody.appendChild(tr);
    });
}

function clearChartData() {
    // 모든 차트 데이터 초기화
    [sensor1TempChart, sensor2TempChart, sensor3TempChart, 
     sensor1CurrentChart, sensor2CurrentChart, sensor3CurrentChart, 
     deviceTempChart, deviceHumiChart].forEach(chart => {
        chart.data.labels = [];
        chart.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        chart.update();
    });
    
    recentData = [];
    updateDataTable();
    
    document.querySelectorAll('.current-value').forEach(el => {
        el.textContent = '--';
    });
}

async function loadHistoricalData(date, type) {
    try {
        const response = await fetch(`/api/data-history?type=${type}&date=${date}`);
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
            // 해당 타입에 맞는 차트들 선택
            let charts = [];
            if (type === 'current') {
                charts = [sensor1CurrentChart, sensor2CurrentChart, sensor3CurrentChart];
            } else if (type === 'temperature') {
                charts = [sensor1TempChart, sensor2TempChart, sensor3TempChart];
            }
            
            // 차트 데이터 초기화
            charts.forEach(chart => {
                chart.data.labels = [];
                chart.data.datasets[0].data = [];
            });
            
            // 히스토리 데이터 추가
            result.data.forEach(item => {
                const time = new Date(item.serverTimestamp);
                const timeLabel = time.toLocaleTimeString('ko-KR');
                
                charts[0].data.labels.push(timeLabel);
                charts[0].data.datasets[0].data.push(item.sensor1);
                
                charts[1].data.labels.push(timeLabel);
                charts[1].data.datasets[0].data.push(item.sensor2);
                
                charts[2].data.labels.push(timeLabel);
                charts[2].data.datasets[0].data.push(item.sensor3);
            });
            
            charts.forEach(chart => chart.update());
        }
    } catch (error) {
        console.error('히스토리 데이터 로드 실패:', error);
    }
}

async function populateDateSelector() {
    const selector = document.getElementById('dateSelector');
    
    try {
        const response = await fetch('/api/available-dates');
        const data = await response.json();
        
        // 기존 옵션 제거 (첫 번째 "날짜 선택" 옵션 제외)
        while (selector.options.length > 1) {
            selector.remove(1);
        }
        
        // 실제 데이터가 있는 날짜만 추가
        data.dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            selector.appendChild(option);
        });
        
        if (data.dates.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "데이터 없음";
            option.disabled = true;
            selector.appendChild(option);
        }
    } catch (error) {
        console.error('Error loading available dates:', error);
    }
}

function downloadCSV(type, date) {
    const link = document.createElement('a');
    link.href = `/api/download-csv?type=${type}&date=${date}`;
    link.download = `${type}_data_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    connectWebSocket();
    populateDateSelector();
    
    document.getElementById('clearData').addEventListener('click', clearChartData);
    
    document.getElementById('dateSelector').addEventListener('change', function(e) {
        const selectedDate = e.target.value;
        if (selectedDate) {
            loadHistoricalData(selectedDate, 'current');
            loadHistoricalData(selectedDate, 'temperature');
        }
    });
    
    document.getElementById('downloadCombinedCsv').addEventListener('click', function() {
        const date = document.getElementById('dateSelector').value;
        if (!date) {
            alert('날짜를 선택해주세요.');
            return;
        }
        downloadCSV('combined', date);
    });
    
    document.getElementById('downloadCurrentCsv').addEventListener('click', function() {
        const date = document.getElementById('dateSelector').value;
        if (!date) {
            alert('날짜를 선택해주세요.');
            return;
        }
        downloadCSV('current', date);
    });
    
    document.getElementById('downloadTempCsv').addEventListener('click', function() {
        const date = document.getElementById('dateSelector').value;
        if (!date) {
            alert('날짜를 선택해주세요.');
            return;
        }
        downloadCSV('temperature', date);
    });
});