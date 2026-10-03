import type { ShowDefinition } from '../../lib/shows/seed';
import { bakkeojiShow } from './bakkeoji-anneun-maeumdeul';

/** scripts/seed-show.ts가 slug로 찾는 등록부. 새 공연은 파일을 만들고 여기에 한 줄 더한다. */
export const SHOW_DEFINITIONS: readonly ShowDefinition[] = [bakkeojiShow];
