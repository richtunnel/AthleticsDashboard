import { MarketingLayout } from "../../components/layoutHome";

export default function Layout(props: { children: React.ReactNode }) {
  return <MarketingLayout>{props.children}</MarketingLayout>;
}
