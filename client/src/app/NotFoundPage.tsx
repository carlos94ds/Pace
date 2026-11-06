import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from './PageHeader';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('notFound.title')} subtitle={t('notFound.text')} />
      <Link to="/" className="text-sm font-medium text-accent hover:underline">
        {t('notFound.back')}
      </Link>
    </>
  );
}
