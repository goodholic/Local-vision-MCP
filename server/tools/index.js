import { z } from "zod";

/**
 * Register all MCP tools that Claude Code can use.
 * Each tool sends a command to the local PC via sendCommand().
 */
export function registerTools(server, sendCommand) {

  // ════════════════════════════════════════════════════════════════
  // 1. SCREEN CAPTURE / VISION
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "capture_screen",
    `로컬 PC 화면을 캡처합니다. 듀얼 모니터 지원: monitor=0(주), monitor=1(보조), monitor='all'(전체).
[중요] 캡처 이미지는 리사이즈될 수 있습니다. 마우스 좌표를 사용할 때는 반드시 응답의 scaleX/scaleY를 곱하여 실제 화면 좌표로 변환하세요.
예: 이미지에서 (500, 300) 위치 → 실제 좌표 = (500*scaleX + offsetX, 300*scaleY + offsetY)`,
    {
      monitor: z.union([z.number(), z.string()]).optional().describe("모니터 선택: 0=주모니터, 1=보조모니터, 'all'=전체 (기본값: 주모니터)"),
      quality: z.number().min(1).max(100).optional().describe("JPEG 품질 (1-100, 기본값: 60)"),
      maxWidth: z.number().optional().describe("최대 가로 픽셀 (리사이즈, 기본값: 1920)"),
    },
    async (params) => {
      const result = await sendCommand("capture_screen", params);
      const monitorLabel = params.monitor === "all" ? "전체" : params.monitor != null ? `모니터${params.monitor}` : "주모니터";
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          {
            type: "text",
            text: `${monitorLabel} 캡처 완료 (이미지: ${result.width}x${result.height}, 실제화면: ${result.screenWidth}x${result.screenHeight})\n좌표 변환: scaleX=${result.scaleX}, scaleY=${result.scaleY}, offsetX=${result.monitorOffset.x}, offsetY=${result.monitorOffset.y}\n마우스 좌표 = (이미지X * ${result.scaleX} + ${result.monitorOffset.x}, 이미지Y * ${result.scaleY} + ${result.monitorOffset.y})`,
          },
        ],
      };
    }
  );

  server.tool(
    "capture_region",
    "화면의 특정 영역만 캡처합니다. 특정 창이나 UI 요소를 자세히 볼 때 사용하세요.",
    {
      x: z.number().describe("시작 X 좌표"),
      y: z.number().describe("시작 Y 좌표"),
      width: z.number().describe("캡처 너비"),
      height: z.number().describe("캡처 높이"),
      quality: z.number().min(1).max(100).optional().describe("JPEG 품질 (기본값: 80)"),
      monitor: z.union([z.number(), z.string()]).optional().describe("모니터 선택 (기본값: 주모니터)"),
    },
    async (params) => {
      const result = await sendCommand("capture_region", params);
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          {
            type: "text",
            text: `영역 캡처 완료 (${params.x},${params.y} → ${params.width}x${params.height})\n좌표 변환: scaleX=${result.scaleX}, scaleY=${result.scaleY}, offsetX=${result.monitorOffset.x}, offsetY=${result.monitorOffset.y}`,
          },
        ],
      };
    }
  );

  server.tool(
    "capture_window",
    "특정 프로그램 창을 캡처합니다. 창 제목의 일부를 입력하세요.",
    {
      titlePattern: z.string().describe("창 제목에 포함된 문자열 (예: 'Unity', 'Visual Studio')"),
      quality: z.number().min(1).max(100).optional().describe("JPEG 품질 (기본값: 70)"),
    },
    async (params) => {
      const result = await sendCommand("capture_window", params);
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          { type: "text", text: `창 캡처 완료: "${result.windowTitle}" (${result.width}x${result.height})` },
        ],
      };
    }
  );

  server.tool(
    "list_windows",
    "현재 열려 있는 모든 창 목록을 가져옵니다.",
    {},
    async (params) => {
      const result = await sendCommand("list_windows", params);
      return {
        content: [{ type: "text", text: JSON.stringify(result.windows, null, 2) }],
      };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 2. MOUSE CONTROL
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "mouse_move",
    "마우스를 지정된 좌표로 이동합니다.",
    {
      x: z.number().describe("X 좌표"),
      y: z.number().describe("Y 좌표"),
    },
    async (params) => {
      await sendCommand("mouse_move", params);
      return { content: [{ type: "text", text: `마우스 이동 완료: (${params.x}, ${params.y})` }] };
    }
  );

  server.tool(
    "mouse_click",
    "마우스 클릭을 수행합니다. 좌표를 지정하면 이동 후 클릭합니다.",
    {
      x: z.number().optional().describe("X 좌표 (생략시 현재 위치)"),
      y: z.number().optional().describe("Y 좌표 (생략시 현재 위치)"),
      button: z.enum(["left", "right", "middle"]).optional().describe("마우스 버튼 (기본값: left)"),
      doubleClick: z.boolean().optional().describe("더블클릭 여부 (기본값: false)"),
    },
    async (params) => {
      await sendCommand("mouse_click", params);
      const btn = params.button || "left";
      const dbl = params.doubleClick ? "더블" : "";
      const pos = params.x != null ? ` (${params.x}, ${params.y})` : " (현재 위치)";
      return { content: [{ type: "text", text: `${btn} ${dbl}클릭 완료${pos}` }] };
    }
  );

  server.tool(
    "mouse_drag",
    "마우스 드래그를 수행합니다. 시작점에서 끝점까지 드래그합니다.",
    {
      startX: z.number().describe("시작 X 좌표"),
      startY: z.number().describe("시작 Y 좌표"),
      endX: z.number().describe("끝 X 좌표"),
      endY: z.number().describe("끝 Y 좌표"),
      button: z.enum(["left", "right"]).optional().describe("마우스 버튼 (기본값: left)"),
      duration: z.number().optional().describe("드래그 지속시간 ms (기본값: 500)"),
    },
    async (params) => {
      await sendCommand("mouse_drag", params);
      return {
        content: [{ type: "text", text: `드래그 완료: (${params.startX},${params.startY}) → (${params.endX},${params.endY})` }],
      };
    }
  );

  server.tool(
    "mouse_scroll",
    "마우스 스크롤을 수행합니다.",
    {
      x: z.number().optional().describe("스크롤 위치 X (생략시 현재 위치)"),
      y: z.number().optional().describe("스크롤 위치 Y (생략시 현재 위치)"),
      amount: z.number().describe("스크롤량 (양수: 아래, 음수: 위)"),
    },
    async (params) => {
      await sendCommand("mouse_scroll", params);
      const dir = params.amount > 0 ? "아래" : "위";
      return { content: [{ type: "text", text: `스크롤 ${dir}로 ${Math.abs(params.amount)} 완료` }] };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 3. KEYBOARD CONTROL
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "keyboard_type",
    "텍스트를 타이핑합니다. 현재 포커스된 입력 필드에 문자열을 입력합니다.",
    {
      text: z.string().describe("입력할 텍스트"),
      delayMs: z.number().optional().describe("문자 간 딜레이 ms (기본값: 0)"),
    },
    async (params) => {
      await sendCommand("keyboard_type", params);
      return { content: [{ type: "text", text: `타이핑 완료: "${params.text.substring(0, 50)}${params.text.length > 50 ? '...' : ''}"` }] };
    }
  );

  server.tool(
    "keyboard_press",
    "키보드 단축키 또는 특수 키를 누릅니다.",
    {
      keys: z.array(z.string()).describe("누를 키 목록 (예: ['control', 's'] → Ctrl+S)"),
    },
    async (params) => {
      await sendCommand("keyboard_press", params);
      return { content: [{ type: "text", text: `키 입력 완료: ${params.keys.join("+")}` }] };
    }
  );

  server.tool(
    "keyboard_shortcut",
    "자주 사용하는 단축키를 이름으로 실행합니다.",
    {
      name: z.enum([
        "copy", "paste", "cut", "undo", "redo", "save", "save_all",
        "select_all", "find", "find_replace", "new_file", "close_tab",
        "switch_tab", "delete_line", "comment_line", "format_document",
      ]).describe("단축키 이름"),
    },
    async (params) => {
      await sendCommand("keyboard_shortcut", params);
      return { content: [{ type: "text", text: `단축키 실행 완료: ${params.name}` }] };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 4. UNITY SPECIFIC TOOLS
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "unity_capture_console",
    "Unity 콘솔 창을 캡처하여 에러/경고/로그를 읽어옵니다.",
    {
      filter: z.enum(["all", "errors", "warnings", "logs"]).optional().describe("필터 (기본값: all)"),
    },
    async (params) => {
      const result = await sendCommand("unity_capture_console", params);
      return {
        content: [
          ...(result.image ? [{ type: "image", data: result.image, mimeType: "image/jpeg" }] : []),
          { type: "text", text: result.consoleText || "콘솔 내용을 읽었습니다." },
        ],
      };
    }
  );

  server.tool(
    "unity_capture_hierarchy",
    "Unity Hierarchy 창을 캡처하여 게임 오브젝트 구조를 확인합니다.",
    {},
    async (params) => {
      const result = await sendCommand("unity_capture_hierarchy", params);
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          { type: "text", text: "Hierarchy 창 캡처 완료" },
        ],
      };
    }
  );

  server.tool(
    "unity_capture_inspector",
    "Unity Inspector 창을 캡처하여 선택된 오브젝트의 속성을 확인합니다.",
    {},
    async (params) => {
      const result = await sendCommand("unity_capture_inspector", params);
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          { type: "text", text: "Inspector 창 캡처 완료" },
        ],
      };
    }
  );

  server.tool(
    "unity_capture_scene",
    "Unity Scene 뷰 또는 Game 뷰를 캡처합니다.",
    {
      view: z.enum(["scene", "game"]).optional().describe("캡처할 뷰 (기본값: scene)"),
    },
    async (params) => {
      const result = await sendCommand("unity_capture_scene", params);
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          { type: "text", text: `Unity ${params.view || "scene"} 뷰 캡처 완료` },
        ],
      };
    }
  );

  server.tool(
    "unity_capture_project",
    "Unity Project 창(파일 브라우저)을 캡처합니다.",
    {},
    async (params) => {
      const result = await sendCommand("unity_capture_project", params);
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          { type: "text", text: "Project 창 캡처 완료" },
        ],
      };
    }
  );

  server.tool(
    "unity_play_stop",
    "Unity 에디터의 Play/Stop 버튼을 누릅니다.",
    {
      action: z.enum(["play", "stop", "pause"]).describe("수행할 액션"),
    },
    async (params) => {
      await sendCommand("unity_play_stop", params);
      return { content: [{ type: "text", text: `Unity ${params.action} 완료` }] };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 5. STABLE DIFFUSION TOOLS
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "sd_generate_image",
    "Stable Diffusion WebUI에서 이미지를 생성합니다. 프롬프트를 입력하고 Generate 버튼을 클릭합니다.",
    {
      prompt: z.string().describe("긍정 프롬프트 (영어)"),
      negativePrompt: z.string().optional().describe("부정 프롬프트"),
      width: z.number().optional().describe("이미지 너비 (기본값: 512)"),
      height: z.number().optional().describe("이미지 높이 (기본값: 512)"),
      steps: z.number().optional().describe("샘플링 스텝 수 (기본값: 20)"),
      seed: z.number().optional().describe("시드 (-1: 랜덤)"),
    },
    async (params) => {
      const result = await sendCommand("sd_generate_image", params, 120000); // 2min timeout
      return {
        content: [
          ...(result.image ? [{ type: "image", data: result.image, mimeType: "image/png" }] : []),
          { type: "text", text: result.message || "이미지 생성 완료" },
        ],
      };
    }
  );

  server.tool(
    "sd_capture_output",
    "Stable Diffusion WebUI의 출력 이미지를 캡처합니다.",
    {},
    async (params) => {
      const result = await sendCommand("sd_capture_output", params);
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          { type: "text", text: "SD 출력 이미지 캡처 완료" },
        ],
      };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 6. FILE SYSTEM (LOCAL PC)
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "local_read_file",
    "로컬 PC의 파일을 읽습니다.",
    {
      path: z.string().describe("파일 경로 (절대 경로)"),
      encoding: z.string().optional().describe("인코딩 (기본값: utf-8)"),
    },
    async (params) => {
      const result = await sendCommand("local_read_file", params);
      return { content: [{ type: "text", text: result.content }] };
    }
  );

  server.tool(
    "local_write_file",
    "로컬 PC에 파일을 씁니다.",
    {
      path: z.string().describe("파일 경로 (절대 경로)"),
      content: z.string().describe("파일 내용"),
      encoding: z.string().optional().describe("인코딩 (기본값: utf-8)"),
    },
    async (params) => {
      await sendCommand("local_write_file", params);
      return { content: [{ type: "text", text: `파일 저장 완료: ${params.path}` }] };
    }
  );

  server.tool(
    "local_list_directory",
    "로컬 PC의 디렉토리 내용을 나열합니다.",
    {
      path: z.string().describe("디렉토리 경로"),
      recursive: z.boolean().optional().describe("하위 폴더 포함 여부 (기본값: false)"),
      maxDepth: z.number().optional().describe("최대 탐색 깊이 (recursive일 때, 기본값: 3)"),
    },
    async (params) => {
      const result = await sendCommand("local_list_directory", params);
      return { content: [{ type: "text", text: JSON.stringify(result.entries, null, 2) }] };
    }
  );

  server.tool(
    "local_run_command",
    "로컬 PC에서 셸 명령어를 실행합니다.",
    {
      command: z.string().describe("실행할 명령어"),
      cwd: z.string().optional().describe("작업 디렉토리"),
      timeoutMs: z.number().optional().describe("타임아웃 ms (기본값: 30000)"),
    },
    async (params) => {
      const result = await sendCommand("local_run_command", params, params.timeoutMs || 30000);
      return {
        content: [{
          type: "text",
          text: `Exit code: ${result.exitCode}\n\n--- STDOUT ---\n${result.stdout}\n\n--- STDERR ---\n${result.stderr}`,
        }],
      };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 7. GAME PLANNING / ANALYSIS TOOLS
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "analyze_screen_layout",
    "현재 화면을 캡처하고 UI 레이아웃을 분석할 수 있도록 고해상도로 반환합니다. 세부 기획 시 사용하세요.",
    {
      region: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }).optional().describe("분석할 영역 (생략시 전체 화면)"),
    },
    async (params) => {
      const result = await sendCommand("analyze_screen_layout", params);
      return {
        content: [
          { type: "image", data: result.image, mimeType: "image/jpeg" },
          { type: "text", text: `화면 분석용 고해상도 캡처 완료 (${result.width}x${result.height})` },
        ],
      };
    }
  );

  server.tool(
    "find_ui_element",
    "화면에서 특정 텍스트나 UI 요소의 위치를 찾습니다. OCR + 템플릿 매칭을 사용합니다.",
    {
      text: z.string().optional().describe("찾을 텍스트"),
      templateImage: z.string().optional().describe("템플릿 이미지 base64 (버튼 아이콘 등)"),
      searchRegion: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }).optional().describe("검색 범위 (생략시 전체 화면)"),
    },
    async (params) => {
      const result = await sendCommand("find_ui_element", params, 30000);
      if (result.found) {
        return {
          content: [{
            type: "text",
            text: `요소 발견! 위치: (${result.x}, ${result.y}), 크기: ${result.width}x${result.height}, 신뢰도: ${result.confidence}`,
          }],
        };
      }
      return { content: [{ type: "text", text: "요소를 찾지 못했습니다." }] };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 8. CLIPBOARD
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "clipboard_read",
    "로컬 PC의 클립보드 내용을 읽습니다.",
    {},
    async (params) => {
      const result = await sendCommand("clipboard_read", params);
      return { content: [{ type: "text", text: result.text || "(클립보드가 비어있습니다)" }] };
    }
  );

  server.tool(
    "clipboard_write",
    "로컬 PC의 클립보드에 텍스트를 복사합니다.",
    {
      text: z.string().describe("클립보드에 넣을 텍스트"),
    },
    async (params) => {
      await sendCommand("clipboard_write", params);
      return { content: [{ type: "text", text: "클립보드에 복사 완료" }] };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 9. WAIT / TIMING
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "wait",
    "지정된 시간만큼 대기합니다. UI 로딩이나 애니메이션 완료를 기다릴 때 사용합니다.",
    {
      ms: z.number().min(100).max(30000).describe("대기 시간 (밀리초, 최대 30초)"),
    },
    async (params) => {
      await sendCommand("wait", params);
      return { content: [{ type: "text", text: `${params.ms}ms 대기 완료` }] };
    }
  );

  server.tool(
    "wait_for_change",
    "화면의 특정 영역이 변경될 때까지 대기합니다. 로딩 완료 감지 등에 사용합니다.",
    {
      region: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }).describe("감시할 영역"),
      timeoutMs: z.number().optional().describe("최대 대기 시간 ms (기본값: 10000)"),
      threshold: z.number().optional().describe("변경 감지 임계값 0-1 (기본값: 0.05)"),
    },
    async (params) => {
      const result = await sendCommand("wait_for_change", params, (params.timeoutMs || 10000) + 5000);
      return {
        content: [{
          type: "text",
          text: result.changed
            ? `영역 변경 감지됨 (${result.elapsedMs}ms)`
            : `타임아웃: 영역이 변경되지 않았습니다`,
        }],
      };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 10. BATCH EXECUTE (multiple actions in one round-trip)
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "batch_execute",
    `여러 동작을 한 번의 통신으로 일괄 실행합니다. 속도가 중요할 때 사용하세요.
예시: 새 메모장 열고 텍스트 입력 → actions: [
  { command: "clipboard_write", params: { text: "hello" } },
  { command: "mouse_click", params: { x: 500, y: 300 } },
  { command: "keyboard_shortcut", params: { name: "paste" } },
  { command: "capture_screen", params: { quality: 50 } }
]
사용 가능한 command: capture_screen, capture_region, mouse_click, mouse_move, mouse_drag, mouse_scroll, keyboard_type, keyboard_press, keyboard_shortcut, clipboard_write, clipboard_read, local_run_command, local_read_file, local_write_file, wait, list_windows 등 모든 기존 도구

[팁] Claude Code(Cursor)가 "진행할까요?" 등 확인을 물으면 auto_accept_prompt 도구를 사용하거나,
batch_execute로 keyboard_type("y") + keyboard_press(["enter"])를 보내세요.`,
    {
      actions: z.array(z.object({
        command: z.string().describe("실행할 명령어 이름"),
        params: z.record(z.any()).optional().describe("명령어 파라미터"),
        waitBefore: z.number().optional().describe("이 동작 실행 전 대기 ms"),
      })).describe("순서대로 실행할 동작 목록"),
      stopOnError: z.boolean().optional().describe("에러 발생 시 중단 여부 (기본값: false)"),
    },
    async (params) => {
      // Calculate timeout: 10s base + 5s per action + extra for captures/commands
      const actionCount = params.actions.length;
      const totalWait = params.actions.reduce((s, a) => s + (a.waitBefore || 0), 0);
      const timeoutMs = Math.max(60000, 10000 + actionCount * 5000 + totalWait);

      const result = await sendCommand("batch_execute", params, timeoutMs);
      const content = [];

      // Build response: collect all images and text results
      let summary = [];
      for (const r of result.results) {
        if (!r.success) {
          summary.push(`[${r.index}] ${r.command}: ERROR - ${r.error}`);
          continue;
        }
        summary.push(`[${r.index}] ${r.command}: OK`);
        // If result contains an image, include it
        if (r.result && r.result.image) {
          content.push({
            type: "image",
            data: r.result.image,
            mimeType: "image/jpeg",
          });
        }
      }

      content.push({
        type: "text",
        text: `Batch 완료 (${result.results.length}개 동작)\n${summary.join("\n")}`,
      });

      // Append any non-image data from results
      for (const r of result.results) {
        if (r.success && r.result) {
          if (r.result.text) content.push({ type: "text", text: r.result.text });
          if (r.result.content) content.push({ type: "text", text: r.result.content });
          if (r.result.windows) content.push({ type: "text", text: JSON.stringify(r.result.windows, null, 2) });
          if (r.result.stdout !== undefined) content.push({ type: "text", text: `stdout: ${r.result.stdout}` });
        }
      }

      return { content };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 11. CLAUDE CODE AUTOMATION
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "auto_accept_prompt",
    `Claude Code(Cursor 등)에서 "진행할까요?", "Proceed?", "Do you want to..." 등의 확인 질문이 나올 때 자동으로 수락합니다.
'y'를 입력하고 Enter를 눌러 자동 승인합니다. Claude Code가 권한을 물어볼 때 사용하세요.
[중요] 이 도구는 Claude Code 터미널이 활성화(포커스)된 상태에서만 동작합니다.`,
    {
      response: z.string().optional().describe("입력할 응답 (기본값: 'y')"),
      pressEnter: z.boolean().optional().describe("Enter 키도 누를지 (기본값: true)"),
    },
    async (params) => {
      const response = params.response || "y";
      const pressEnter = params.pressEnter !== false;

      const actions = [
        { command: "keyboard_type", params: { text: response } },
      ];
      if (pressEnter) {
        actions.push({ command: "keyboard_press", params: { keys: ["enter"] } });
      }

      const result = await sendCommand("batch_execute", { actions, stopOnError: false });
      return {
        content: [{
          type: "text",
          text: `자동 수락 완료: "${response}" 입력${pressEnter ? " + Enter" : ""}`,
        }],
      };
    }
  );

  server.tool(
    "reconnect_claude_mcp",
    `Claude Code의 MCP 연결이 끊어졌을 때 재연결을 수행합니다.
순서: 1) 현재 터미널에서 Ctrl+C로 종료 2) 'claude' 입력하여 Claude Code 재시작 3) '/mcp' 입력하여 MCP 재연결
[주의] Claude Code가 실행 중인 터미널이 활성화(포커스)된 상태에서 사용하세요.`,
    {
      terminalAction: z.enum(["restart_claude", "send_mcp_command", "full_reconnect"]).describe(
        "restart_claude: Ctrl+C 후 claude 재실행, send_mcp_command: /mcp만 입력, full_reconnect: 전체 재연결 수행"
      ),
      waitMs: z.number().optional().describe("각 단계 사이 대기 시간 ms (기본값: 2000)"),
    },
    async (params) => {
      const wait = params.waitMs || 2000;
      let actions = [];

      if (params.terminalAction === "send_mcp_command") {
        actions = [
          { command: "keyboard_type", params: { text: "/mcp" } },
          { command: "keyboard_press", params: { keys: ["enter"] } },
        ];
      } else if (params.terminalAction === "restart_claude") {
        actions = [
          // Ctrl+C to stop current process
          { command: "keyboard_press", params: { keys: ["control", "c"] } },
          { command: "wait", params: { ms: wait }, waitBefore: 500 },
          // Type 'claude' to restart
          { command: "keyboard_type", params: { text: "claude" } },
          { command: "keyboard_press", params: { keys: ["enter"] } },
        ];
      } else {
        // full_reconnect
        actions = [
          // Ctrl+C to stop current process
          { command: "keyboard_press", params: { keys: ["control", "c"] } },
          { command: "wait", params: { ms: wait }, waitBefore: 500 },
          // Type 'claude' to restart
          { command: "keyboard_type", params: { text: "claude" } },
          { command: "keyboard_press", params: { keys: ["enter"] } },
          // Wait for Claude Code to start
          { command: "wait", params: { ms: Math.max(wait * 2, 5000) } },
          // Type /mcp to reconnect
          { command: "keyboard_type", params: { text: "/mcp" } },
          { command: "keyboard_press", params: { keys: ["enter"] } },
        ];
      }

      const timeoutMs = 10000 + actions.length * 5000 + (wait * 3);
      const result = await sendCommand("batch_execute", { actions, stopOnError: false }, timeoutMs);
      return {
        content: [{
          type: "text",
          text: `MCP 재연결 수행 완료 (${params.terminalAction}). Claude Code가 정상 시작되었는지 확인해주세요.`,
        }],
      };
    }
  );

  // ════════════════════════════════════════════════════════════════
  // 12. SYSTEM INFO
  // ════════════════════════════════════════════════════════════════

  server.tool(
    "get_screen_info",
    "로컬 PC의 화면 해상도, 모니터 수 등 디스플레이 정보를 가져옵니다.",
    {},
    async (params) => {
      const result = await sendCommand("get_screen_info", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_mouse_position",
    "현재 마우스 커서 위치를 가져옵니다.",
    {},
    async (params) => {
      const result = await sendCommand("get_mouse_position", params);
      return { content: [{ type: "text", text: `마우스 위치: (${result.x}, ${result.y})` }] };
    }
  );

  server.tool(
    "get_active_window",
    "현재 활성화된 창 정보를 가져옵니다.",
    {},
    async (params) => {
      const result = await sendCommand("get_active_window", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "ping_local",
    "로컬 PC 연결 상태를 확인합니다.",
    {},
    async (params) => {
      const result = await sendCommand("ping_local", params, 5000);
      return { content: [{ type: "text", text: `로컬 PC 연결 정상 (응답: ${result.latencyMs}ms)` }] };
    }
  );
}
