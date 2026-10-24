import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import styles from './walkthrough.module.css'

function Walkthroughs() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer()
    renderer.setClearColor(0x000000)
    mount.appendChild(renderer.domElement)

    return () => {
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={mountRef} className={styles.window} />
}

export default Walkthroughs
