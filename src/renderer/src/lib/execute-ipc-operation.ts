import { toast } from '@heroui/react/toast'
import type { OperationResult } from '../../../shared/skills-types'

type ExecuteIpcOperationOptions = {
  skipErrorHandler?: boolean
}

export class IpcOperationError extends Error {
  readonly logs: string[]

  constructor(logs: string[]) {
    super(logs[0] || '请稍后重试。')
    this.name = 'IpcOperationError'
    this.logs = logs
  }
}

export async function executeIpcOperation<T>(action: () => Promise<T>, options: ExecuteIpcOperationOptions = {}): Promise<T> {
  try {
    const result = await action()

    if (isOperationResult(result) && !result.ok) {
      throw new IpcOperationError(result.logs)
    }

    return result
  } catch (error) {
    if (!options.skipErrorHandler) {
      const description = error instanceof IpcOperationError ? error.logs.slice(0, 3).join('\n') || '请稍后重试。' : getErrorMessage(error)
      toast.danger('操作失败', {
        description
      })
    }

    throw error
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isOperationResult(value: unknown): value is OperationResult {
  return typeof value === 'object' && value !== null && 'ok' in value && 'logs' in value
}
