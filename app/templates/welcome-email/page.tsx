import { Suspense } from "react";
import { TemplateBuilder } from "@/components/templates/template-builder";

export default function TemplateBuilderPage() {
  return (
    <Suspense fallback={null}>
      <TemplateBuilder />
    </Suspense>
  );
}
