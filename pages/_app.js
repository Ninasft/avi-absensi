import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  console.log("import.meta:", import.meta);
console.log("import.meta.env:", import.meta.env);
  return <Component {...pageProps} />
}

console.log("import.meta:", import.meta);
console.log("import.meta.env:", import.meta.env);