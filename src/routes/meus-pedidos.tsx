import { createFileRoute } from "@tanstack/react-router";
import MyOrdersPage from "../components/MyOrdersPage";

export const Route = createFileRoute("/meus-pedidos")({
  component: MyOrdersPage,
});
