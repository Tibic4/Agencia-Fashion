import { LegalPage } from '@/components/LegalPage';
import { termos } from '@/lib/legal/content';

export default function TermosScreen() {
  return <LegalPage {...termos} />;
}
