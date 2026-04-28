import { LegalPage } from '@/components/LegalPage';
import { subprocessadores } from '@/lib/legal/content';

export default function SubprocessadoresScreen() {
  return <LegalPage {...subprocessadores} />;
}
