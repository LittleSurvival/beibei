# 被被觀察日記

屋簷上的被被照片紀錄。用 React、TypeScript、Vite、Motion 和 Canvas 2D 製作。

```sh
npm ci
npm run dev
npm run check
npm run build
```

照片沿用 `fangyi-timelapse/photos` 下的資料夾。更新紀錄時，新增 `day{編號}.jpg` 並在 `content/days.json` 按 Day 順序加入照片相對路徑、台北日期及 Threads 原文連結。索引中的半日加更照常播放，時間軸從索引推算整數 Day 的缺口。可用 `?day=228.5` 開啟單日紀錄。

播放器的速度與跳轉在 `src/player/usePlayback.ts`，Canvas 繪圖在 `src/player/renderer.ts`，轉場定義在 `src/player/effects.ts`。

GitHub Pages 的發布來源設為 **GitHub Actions**。PR 執行型別檢查、照片索引驗證和建置。推送至 `main` 後，workflow 部署 `dist`。
