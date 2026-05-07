import { createFileRoute } from "@tanstack/react-router";
import TrackingPage from "../components/TrackingPage";

export const Route = createFileRoute("/pedido/$token")({
  component: TrackingPage,
});
