import { defineConfig } from "@playwright/test";

// CI / 로컬 환경 모두에서 동일한 설정 파일을 쓸 수 있게 BASE_URL 환경변수 지원.
//   - 로컬 (PowerShell): 미설정 → http://localhost:8080
//   - GitHub Actions   : BASE_URL=http://127.0.0.1:8080 으로 호출
const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  // CI 에서는 일시적인 네트워크 지연을 흡수하기 위해 1회 재시도
  retries: process.env.CI ? 1 : 0,
  // 실패 시 GitHub Actions artifact 로 업로드할 HTML 리포트
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
