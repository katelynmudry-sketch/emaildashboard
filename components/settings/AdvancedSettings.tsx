"use client"

import { SectionLabel } from "./shared"
import AiSystemPromptSettings from "./AiSystemPromptSettings"
import FullPromptPreview from "./FullPromptPreview"

interface ContextData {
  systemContext: string
  categorizeInstructions: string
  seedCustom: { personal: string; work: string }
}

interface Props {
  data: ContextData | null
}

export default function AdvancedSettings({ data }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <AiSystemPromptSettings data={data} />

      <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)", paddingTop: 18 }}>
        <SectionLabel color="#8B3FD8">Full prompt preview</SectionLabel>
        <FullPromptPreview data={data} />
      </div>
    </div>
  )
}
