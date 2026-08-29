import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import ShowPage from "./ShowPage";
import PlayerPage from "./PlayerPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/show/:id" element={<ShowPage />} />
        <Route path="/watch/:episodeId" element={<PlayerPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
