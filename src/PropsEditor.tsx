import React from "react";
import { COLOR_MARKER } from "./core";
import type { z } from "./core";

/**
 * 从 zod schema 自动生成表单(schema → UI)。
 * 通过读取 zod 内部的 _def(typeName / checks / values / description)决定每个字段渲染成什么控件。
 * 这正是 Remotion Studio "props 编辑器"的核心思路。
 */

type FieldProps = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: z.ZodTypeAny;
  value: unknown;
  onChange: (v: unknown) => void;
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 14,
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  background: "#0b1120",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const getNumberBounds = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: any,
): { min?: number; max?: number } => {
  const checks = def?._def?.checks ?? [];
  let min: number | undefined;
  let max: number | undefined;
  for (const c of checks) {
    if (c.kind === "min") min = c.value;
    if (c.kind === "max") max = c.value;
  }
  return { min, max };
};

const Field: React.FC<FieldProps> = ({ name, def, value, onChange }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = def as any;
  const typeName: string = d?._def?.typeName;
  const description: string | undefined = d?._def?.description;

  // 颜色
  if (typeName === "ZodString" && description === COLOR_MARKER) {
    return (
      <div style={rowStyle}>
        <label style={labelStyle}>{name}</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="color"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: 40,
              height: 34,
              padding: 0,
              border: "1px solid #334155",
              borderRadius: 6,
              background: "transparent",
            }}
          />
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
    );
  }

  // 普通字符串
  if (typeName === "ZodString") {
    return (
      <div style={rowStyle}>
        <label style={labelStyle}>{name}</label>
        <input
          type="text"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      </div>
    );
  }

  // 数字(带 min/max 时同时给滑块)
  if (typeName === "ZodNumber") {
    const { min, max } = getNumberBounds(d);
    const hasRange = min !== undefined && max !== undefined;
    return (
      <div style={rowStyle}>
        <label style={labelStyle}>
          {name} {hasRange ? `(${min}–${max})` : ""}
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {hasRange ? (
            <input
              type="range"
              min={min}
              max={max}
              value={Number(value)}
              onChange={(e) => onChange(Number(e.target.value))}
              style={{ flex: 1, accentColor: "#3b82f6" }}
            />
          ) : null}
          <input
            type="number"
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ ...inputStyle, width: hasRange ? 80 : "100%" }}
          />
        </div>
      </div>
    );
  }

  // 布尔
  if (typeName === "ZodBoolean") {
    return (
      <div style={{ ...rowStyle, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "#3b82f6" }}
        />
        <label style={{ ...labelStyle, marginBottom: 0 }}>{name}</label>
      </div>
    );
  }

  // 枚举
  if (typeName === "ZodEnum") {
    const values: string[] = d?._def?.values ?? [];
    return (
      <div style={rowStyle}>
        <label style={labelStyle}>{name}</label>
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          {values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // 兜底:JSON 文本
  return (
    <div style={rowStyle}>
      <label style={labelStyle}>
        {name} <span style={{ opacity: 0.6 }}>({typeName})</span>
      </label>
      <input
        type="text"
        value={JSON.stringify(value)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            /* 忽略非法 JSON */
          }
        }}
        style={inputStyle}
      />
    </div>
  );
};

export const PropsEditor: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodType<any> | undefined;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  onReset: () => void;
}> = ({ schema, value, onChange, onReset }) => {
  if (!schema) {
    return (
      <div style={{ fontSize: 12, color: "#64748b" }}>
        该 composition 未定义 schema,无可编辑参数。
      </div>
    );
  }

  // 取出 ZodObject 的字段表
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape: Record<string, z.ZodTypeAny> | undefined = (schema as any)?._def
    ?.shape?.();
  if (!shape) {
    return (
      <div style={{ fontSize: 12, color: "#64748b" }}>
        schema 不是对象类型,暂不支持编辑。
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
          PROPS
        </div>
        <button
          onClick={onReset}
          style={{
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 5,
            border: "1px solid #334155",
            background: "transparent",
            color: "#94a3b8",
            cursor: "pointer",
          }}
        >
          重置
        </button>
      </div>
      {Object.entries(shape).map(([key, def]) => (
        <Field
          key={key}
          name={key}
          def={def}
          value={value[key]}
          onChange={(v) => onChange({ ...value, [key]: v })}
        />
      ))}
    </div>
  );
};
