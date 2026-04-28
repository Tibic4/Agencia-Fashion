import { LegalPage } from '@/components/LegalPage';
import { dpo } from '@/lib/legal/content';

export default function DpoScreen() {
  return <LegalPage {...dpo} />;
}
