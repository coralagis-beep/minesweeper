# 經典踩地雷 Minesweeper

經典復古 Windows 經典風格踩地雷遊戲（Minesweeper），採用現代前端技術（React 19 + TypeScript + Vite + Tailwind CSS）打造，重現經典灰底浮雕 3D 立體按鈕、七段顯示器數字、笑臉狀態反饋、空白區域連鎖擴展、插旗標記與勝負判定。

---

## 🌟 特色功能

- 🕹️ **經典 Windows 95/98 復古風格**：精準還原凹凸立體按鈕、灰色經典配色與經典數字顏色（1藍、2綠、3紅、4深藍...）。
- 😊 **互動笑臉按鈕**：
  - 常態：😊
  - 點擊按壓中：😮
  - 獲勝：😎
  - 踩雷踩爆：😵
  - 點擊隨時重新開局
- 🚩 **標記地雷（插旗）**：
  - 電腦版支援滑鼠右鍵點擊插旗／取消插旗。
  - 手機／平板觸控支援插旗切換按鈕。
- ⚡ **連鎖空白遞迴展開**：點擊 0 鄰雷區域時自動智慧連鎖翻開相連的安全方格。
- ⏱️ **復古七段顯示器**：即時顯示剩餘地雷數與已進行秒數（000 ~ 999）。
- 🎯 **多種難度切換**：
  - 初級：9 × 9（10 顆地雷）
  - 中級：16 × 16（40 顆地雷）
  - 高級：16 × 30（99 顆地雷）
- 🚀 **雙版本支援**：
  1. **React 現代版**（本專案主架構，模組化、支援熱重載與建置）
  2. **單一獨立 HTML 檔案**（見 `standalone.html`，無須任何依賴，雙擊即可在任何瀏覽器遊玩）

---

## 🚀 如何發布至您的 GitHub

### 方法一：使用 AI Studio 一鍵同步至 GitHub（最推薦）
1. 在 AI Studio 畫面右上角，點擊 **「Export」** 或 **「Sync with GitHub」**（或「分享 / 匯出」選單）。
2. 授權您的 GitHub 帳號並選擇建立新的儲存庫（Repository，例如 `minesweeper`）。
3. 系統將會自動將所有程式碼與 Commit 推送至您的 GitHub！

### 方法二：使用 Git 指令推送到您的 GitHub
1. 先在 [GitHub](https://github.com/new) 建立一個新的空白專案（例如命名為 `minesweeper`，不要勾選初始化 README）。
2. 在終端機執行下列指令（將 `<your-username>` 替換為您的 GitHub 帳號）：

```bash
# 關聯您的 GitHub 儲存庫
git remote add origin https://github.com/<your-username>/minesweeper.git

# 設定主分支為 main
git branch -M main

# 推送所有程式碼至 GitHub
git push -u origin main
```

---

## 🌐 一鍵啟用 GitHub Pages 免費線上遊玩

本專案已內建 GitHub Actions 自動部署工作流程（`.github/workflows/deploy.yml`）。
將專案推送到 GitHub 後：
1. 進入您 GitHub 儲存庫的 **Settings** > **Pages**。
2. 在 **Build and deployment** 下方的 **Source** 選擇 **GitHub Actions**。
3. 每次只要推送代碼，GitHub 就會自動為您建置並發布線上可遊玩的網址！

---

## 💻 本地端開發與啟動

確保您已安裝 [Node.js](https://nodejs.org/) (建議 v18 以上)。

```bash
# 1. 安裝專案依賴套件
npm install

# 2. 啟動本機開發伺服器
npm run dev

# 3. 建置生產環境最佳化檔案
npm run build
```

啟動後請用瀏覽器開啟 `http://localhost:3000` 即可遊玩！

---

## 📄 單檔免安裝版本

如果您只需要單一 HTML 檔案，可以直接開啟本專案中的 `standalone.html`，完全不依賴任何外部伺服器或打包工具，即可在離線狀態下暢玩。
