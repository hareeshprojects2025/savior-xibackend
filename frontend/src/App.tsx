import { Routes, Route } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { FeedPage } from "@/pages/FeedPage"
import { MapPage } from "@/pages/MapPage"
import { StatsPage } from "@/pages/StatsPage"
import { TranscriptionPage } from "@/pages/TranscriptionPage"
import { DispatchPage } from "@/pages/DispatchPage"

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<FeedPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="transcriptions" element={<TranscriptionPage />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="*" element={<FeedPage />} />
      </Route>
    </Routes>
  )
}
