import { useEffect, useState } from "react";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Busca os documentos de usuarios/{uid} para uma lista de uids (até 30, limite do Firestore "in").
export function useUsuarios(uids) {
  const [usuarios, setUsuarios] = useState({});
  const chave = (uids || []).slice().sort().join(",");

  useEffect(() => {
    if (!uids || uids.length === 0) {
      setUsuarios({});
      return;
    }
    let ativo = true;
    (async () => {
      const q = query(collection(db, "usuarios"), where(documentId(), "in", uids.slice(0, 30)));
      const snap = await getDocs(q);
      if (!ativo) return;
      const mapa = {};
      snap.docs.forEach((d) => {
        mapa[d.id] = { id: d.id, ...d.data() };
      });
      setUsuarios(mapa);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return usuarios;
}
