import { useState } from "react";

type Props = { label: string };

export function Button({ label }: Props) {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{label} {n}</button>;
}

const Inner = () => <span />;

export default Inner;
