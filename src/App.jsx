import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { firebaseConfigurado } from "./firebase";
import SetupNeededPage from "./pages/SetupNeededPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import FrentePage from "./pages/FrentePage";
import ItemFormPage from "./pages/ItemFormPage";
import ItemDetailPage from "./pages/ItemDetailPage";
import SharingPage from "./pages/SharingPage";
import ContratosListPage from "./pages/ContratosListPage";
import ContratoFormPage from "./pages/ContratoFormPage";
import ContratoDetailPage from "./pages/ContratoDetailPage";
import ContratoSharingPage from "./pages/ContratoSharingPage";
import AditivoFormPage from "./pages/AditivoFormPage";
import AditivoDetailPage from "./pages/AditivoDetailPage";
import CancelamentoFormPage from "./pages/CancelamentoFormPage";

export default function App() {
  if (!firebaseConfigurado) {
    return <SetupNeededPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/frentes/:frenteId" element={<FrentePage />} />
        <Route path="/frentes/:frenteId/novo" element={<ItemFormPage />} />
        <Route path="/frentes/:frenteId/itens/:itemId" element={<ItemDetailPage />} />
        <Route path="/frentes/:frenteId/itens/:itemId/editar" element={<ItemFormPage />} />
        <Route path="/frentes/:frenteId/compartilhar" element={<SharingPage />} />
        <Route path="/contratos" element={<ContratosListPage />} />
        <Route path="/contratos/novo" element={<ContratoFormPage />} />
        <Route path="/contratos/:contratoId" element={<ContratoDetailPage />} />
        <Route path="/contratos/:contratoId/editar" element={<ContratoFormPage />} />
        <Route path="/contratos/:contratoId/compartilhar" element={<ContratoSharingPage />} />
        <Route path="/contratos/:contratoId/itens/novo" element={<ItemFormPage />} />
        <Route path="/contratos/:contratoId/aditivos/novo" element={<AditivoFormPage />} />
        <Route path="/contratos/:contratoId/aditivos/:aditivoId" element={<AditivoDetailPage />} />
        <Route path="/contratos/:contratoId/aditivos/:aditivoId/editar" element={<AditivoFormPage />} />
        <Route path="/contratos/:contratoId/cancelamentos/novo" element={<CancelamentoFormPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
