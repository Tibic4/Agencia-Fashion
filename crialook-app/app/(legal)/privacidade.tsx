import { LegalPage } from '@/components/LegalPage';
import { privacidade } from '@/lib/legal/content';

export default function PrivacidadeScreen() {
  return <LegalPage {...privacidade} />;
}
