import { LegalPage } from '@/components/LegalPage';
import { consentimentoBiometrico } from '@/lib/legal/content';

export default function ConsentimentoBiometricoScreen() {
  return <LegalPage {...consentimentoBiometrico} />;
}
