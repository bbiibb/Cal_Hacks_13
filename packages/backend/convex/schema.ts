import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { vScene, vSceneAction, vSidePanel, vSource, vVec3 } from "./validators";

export default defineSchema({
  // 해부학적 구조물. structureId 는 GLB 메시 이름과 1:1로 일치하는 공통 키.
  structures: defineTable({
    structureId: v.string(),
    nameEn: v.string(),
    nameKo: v.string(),
    parentId: v.optional(v.string()), // 부모의 structureId
    description: v.string(),
  })
    .index("by_structure_id", ["structureId"])
    .index("by_parent_id", ["parentId"]),

  // 수술 기구
  instruments: defineTable({
    instrumentId: v.string(),
    nameEn: v.string(),
    nameKo: v.string(),
    description: v.string(),
  }).index("by_instrument_id", ["instrumentId"]),

  // 수술 과정
  procedures: defineTable({
    slug: v.string(),
    title: v.string(),
    summary: v.string(),
  }).index("by_slug", ["slug"]),

  // 수술 단계: 영상이 아니라 단계별 3D 장면 상태(scene)로 표현
  steps: defineTable({
    procedureId: v.id("procedures"),
    index: v.number(), // 0부터 시작
    title: v.string(),
    scene: vScene,
    sidePanel: vSidePanel,
  }).index("by_procedure_and_index", ["procedureId", "index"]),

  // 구조물에 붙는 주석(라벨/설명)
  annotations: defineTable({
    structureId: v.string(),
    stepId: v.optional(v.id("steps")),
    label: v.string(),
    body: v.string(),
    position: v.optional(vVec3),
  })
    .index("by_structure_id", ["structureId"])
    .index("by_step_id", ["stepId"]),

  // 챗봇 대화 세션 (인증 도입 전까지는 클라이언트가 만든 익명 키 사용)
  chatSessions: defineTable({
    clientSessionId: v.string(),
    procedureSlug: v.optional(v.string()),
    currentStepIndex: v.optional(v.number()),
  }).index("by_client_session_id", ["clientSessionId"]),

  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    // assistant 메시지에만: 검증을 통과한 것만 저장/전달한다
    sceneActions: v.optional(v.array(vSceneAction)),
    sidePanel: v.optional(vSidePanel),
    sources: v.optional(v.array(vSource)),
  }).index("by_session_id", ["sessionId"]),

  // TODO(RAG): 근거 문서 테이블(documents)과 임베딩(embeddings, vectorIndex)은
  //   RAG 구현 단계에서 추가한다. 지금은 정의하지 않는다.
});
