import { createFileRoute } from "@tanstack/react-router";
import OrderPage from "../components/OrderPage";

export const Route = createFileRoute("/")({
  component: OrderPage,
});
