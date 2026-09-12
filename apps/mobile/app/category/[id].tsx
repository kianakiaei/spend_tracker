import { useLocalSearchParams } from "expo-router";
import { ShellNote, ShellPanel } from "../(tabs)/_panel";

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ShellPanel title="دسته">
      <ShellNote>
        نمای جزئیات دسته {id} در تیکت 04 می‌آید — با افزودن خرجِ قفل‌شده روی همین دسته.
      </ShellNote>
    </ShellPanel>
  );
}
