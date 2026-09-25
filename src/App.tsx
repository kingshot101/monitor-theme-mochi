import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppProvider } from "@/context"
import { HomePage } from "@/pages/Home"
import { NodeDetailPage } from "@/pages/NodeDetail"

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/instance/:id" element={<NodeDetailPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
