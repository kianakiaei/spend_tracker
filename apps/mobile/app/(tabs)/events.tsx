import { Link } from "expo-router";
import { Text } from "react-native";
import { ShellNote, ShellPanel } from "./_panel";

export default function EventsScreen() {
  return (
    <ShellPanel title="رویدادها">
      <ShellNote>فهرست رویدادها در تیکت 06 می‌آید.</ShellNote>
      <Link href={{ pathname: "/event/[id]", params: { id: "demo" } }}>
        <Text>نمایش جزئیات رویداد (نمونه)</Text>
      </Link>
    </ShellPanel>
  );
}
