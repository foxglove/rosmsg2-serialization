import { MessageDefinitionField } from "@foxglove/message-definition";

export function messageDefinitionHasData(fields: MessageDefinitionField[]): boolean {
  return fields.some((field) => field.isConstant !== true);
}
