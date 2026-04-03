# Local Vision MCP

Claude Code에게 로컬 PC의 화면을 볼 수 있는 시력과 마우스/키보드 제어 능력을 부여하는 MCP 서버.

## 아키텍처

```
Claude Code ←(SSE/MCP)→ Railway Server ←(Socket.io)→ 로컬 PC
```

- **Railway Server**: MCP 프로토콜(SSE)로 Claude Code와 통신, Socket.io로 로컬 PC에 명령 전달
- **Local Client**: 로컬 PC에서 실행, 화면 캡처/마우스/키보드 제어 수행

## MCP 도구 목록

| 카테고리 | 도구 | 설명 |
|---------|------|------|
| 화면 캡처 | `capture_screen` | 전체 화면 캡처 |
| | `capture_region` | 특정 영역 캡처 |
| | `capture_window` | 특정 창 캡처 |
| | `list_windows` | 열린 창 목록 |
| | `analyze_screen_layout` | 고해상도 레이아웃 분석 |
| | `find_ui_element` | UI 요소 위치 찾기 |
| 마우스 | `mouse_move` | 마우스 이동 |
| | `mouse_click` | 클릭/더블클릭 |
| | `mouse_drag` | 드래그 |
| | `mouse_scroll` | 스크롤 |
| 키보드 | `keyboard_type` | 텍스트 입력 |
| | `keyboard_press` | 키 조합 입력 |
| | `keyboard_shortcut` | 미리 정의된 단축키 |
| Unity | `unity_capture_console` | 콘솔 에러/로그 읽기 |
| | `unity_capture_hierarchy` | Hierarchy 캡처 |
| | `unity_capture_inspector` | Inspector 캡처 |
| | `unity_capture_scene` | Scene/Game 뷰 캡처 |
| | `unity_capture_project` | Project 창 캡처 |
| | `unity_play_stop` | Play/Stop/Pause |
| Stable Diffusion | `sd_generate_image` | 이미지 생성 (API/UI) |
| | `sd_capture_output` | 출력 이미지 캡처 |
| 파일 | `local_read_file` | 로컬 파일 읽기 |
| | `local_write_file` | 로컬 파일 쓰기 |
| | `local_list_directory` | 디렉토리 탐색 |
| | `local_run_command` | 셸 명령 실행 |
| 클립보드 | `clipboard_read` | 클립보드 읽기 |
| | `clipboard_write` | 클립보드 쓰기 |
| 대기 | `wait` | 시간 대기 |
| | `wait_for_change` | 화면 변경 감지 대기 |
| 시스템 | `get_screen_info` | 모니터 정보 |
| | `get_mouse_position` | 마우스 위치 |
| | `get_active_window` | 활성 창 정보 |
| | `ping_local` | 연결 상태 확인 |

## 설치 및 실행

### 1. Railway 서버 배포

```bash
cd server
npm install
# Railway에 배포 (Dockerfile 사용)
# 환경변수: LOCAL_CLIENT_SECRET=비밀키
```

### 2. 로컬 PC 클라이언트 실행

```bash
cd local-client
npm install
cp .env.example .env
# .env에 SERVER_URL과 LOCAL_CLIENT_SECRET 설정
npm start
```

### 3. Claude Code에 MCP 연결

Claude Code 설정에서 MCP 서버 추가:
```json
{
  "mcpServers": {
    "local-vision": {
      "type": "sse",
      "url": "https://your-railway-app.up.railway.app/sse"
    }
  }
}
```

## 환경변수

### Railway Server
| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서버 포트 | 3000 |
| `LOCAL_CLIENT_SECRET` | 로컬 클라이언트 인증 키 | changeme |

### Local Client
| 변수 | 설명 | 기본값 |
|------|------|--------|
| `SERVER_URL` | Railway 서버 URL | http://localhost:3000 |
| `LOCAL_CLIENT_SECRET` | 인증 키 (서버와 동일) | changeme |
| `SD_API_URL` | Stable Diffusion API URL | http://127.0.0.1:7860 |
