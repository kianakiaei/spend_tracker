import { Link } from "expo-router";
import { Text } from "react-native";
import { ShellNote, ShellPanel } from "./_panel";

export default function CategoriesScreen() {
  return (
    <ShellPanel title="دسته‌ها">
      <ShellNote>فهرست دسته‌ها در تیکت 04 می‌آید.</ShellNote>
      <Link href={{ pathname: "/category/[id]", params: { id: "demo" } }}>
        <Text>نمایش جزئیات دسته (نمونه)</Text>
      </Link>
    </ShellPanel>
  );
}
