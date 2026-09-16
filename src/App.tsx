import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { StoreProvider } from "./lib/store";
import { PlayerProvider } from "./lib/player";
import { Shell } from "./components/Shell";
import { Home } from "./pages/Home";
import { Music } from "./pages/Music";
import { ReleasePage } from "./pages/Release";
import { Tracks } from "./pages/Tracks";
import { ArtistPage } from "./pages/Artist";
import { Admin } from "./pages/Admin";

export default function App() {
  return (
    <StoreProvider>
      <PlayerProvider>
        <HashRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<Home />} />
              <Route path="/music" element={<Music />} />
              <Route path="/release/:id" element={<ReleasePage />} />
              <Route path="/tracks" element={<Tracks />} />
              <Route path="/artist/:id" element={<ArtistPage />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </PlayerProvider>
    </StoreProvider>
  );
}
