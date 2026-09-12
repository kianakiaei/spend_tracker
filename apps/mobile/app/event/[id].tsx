import { useLocalSearchParams } from "expo-router";
import { ShellNote, ShellPanel } from "../(tabs)/_panel";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ShellPanel title="رویداد">
      <ShellNote>
        نمای جزئیات رویداد {id} در تیکت 06 می‌آید — با افزودن خرجِ قفل‌شده روی همین رویداد.
      </ShellNote>
    </ShellPanel>
  );
}
