import type { Metadata } from "next";
import { QrView } from "./QrView";

export const metadata: Metadata = { title: "Scan to try CourseRevAI" };

export default function QrPage() {
  return <QrView />;
}
