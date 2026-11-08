import { notFound } from "next/navigation";
import { TrainerApp } from "@/components/TrainerApp";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { I18nProvider } from "@/i18n/I18nProvider";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <I18nProvider locale={lang} dict={dict}>
      <TrainerApp />
    </I18nProvider>
  );
}
