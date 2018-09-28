import { Router } from './Router'
import { Params } from './URLTools'
import { HTTPMethod } from './HTTPMethod'

export interface RouterEnv<Context=any> {
  readonly context: Context
  readonly method: HTTPMethod
  readonly params: Params
  readonly pathname: string
  readonly query: Params
  readonly router: Router<Context>
  readonly unmatchedPathnamePart: string
}
