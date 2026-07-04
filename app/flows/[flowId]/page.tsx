import { FlowBuilder } from "@/components/flows/flow-builder";

type FlowPageProps = {
  params: {
    flowId: string;
  };
};

export default function FlowPage({ params }: FlowPageProps) {
  return <FlowBuilder flowId={params.flowId} />;
}
