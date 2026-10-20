import type { Metadata } from "next";
import ClearScreen from "@/components/ClearScreen";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GameClearPage() {
  return <ClearScreen />;
}
