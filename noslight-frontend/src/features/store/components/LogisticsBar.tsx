// src/features/store/components/LogisticsBar.tsx
import { useState, useEffect } from 'react';
import { Truck, AlertTriangle, Megaphone } from 'lucide-react';
import { motion, AnimatePresence, TargetAndTransition, Transition } from 'framer-motion';
import axios from "@/lib/axios";
import { useNavigate } from 'react-router-dom';


interface NotificationMessage {
    id: string;
    type: 'shipment' | 'low_stock' | 'admin_manual';
    priority: 'urgent' | 'warning' | 'info';
    text: string;
    badgeCount?: number;
}

interface IconAnimationConfig {
    animate: TargetAndTransition;
    transition: Transition;
}

export const LogisticsBar = () => {

    const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // USAR ESTA LÍNEA OFICIAL (Borra la simulación anterior)
    const navigate = useNavigate();
    

    const fetchLiveNotifications = async () => {
        try {
            const activeAlerts: NotificationMessage[] = [];

            // 1. CONSULTA AUTOMÁTICA DE ENVÍOS EN CAMINO
            const transfersRes = await axios.get("/api/transfers", { params: { destination: 2 } });
            const pendingTransfers = transfersRes.data.filter((t: any) => t.status !== "completed");
            const pendingCount = pendingTransfers.length;

            if (pendingCount > 0) {
                activeAlerts.push({
                    id: 'warehouse-transit-alert',
                    type: 'shipment',
                    priority: 'warning',
                    text: `¡Envío en Tránsito! Almacén reporta ${pendingCount} carga(s) en camino hacia tu sucursal. Por favor, revísalas en "Recibir Carga".`,
                    badgeCount: pendingCount
                });
            }

            // 2. LEER TU LISTADO DE ANUNCIOS DESDE EL ENDPOINT DE CONFIGURACIONES GENERALES
            try {
                const token = localStorage.getItem("noslight_token");
                const settingsRes = await fetch(import.meta.env.VITE_API_URL + "/api/settings", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (settingsRes.ok) {
                    const configData = await settingsRes.json();

                    if (configData.admin_announcements) {
                        // Desempaquetamos la cadena JSON de tu base de datos de forma segura
                        const rawList = typeof configData.admin_announcements === 'string'
                            ? JSON.parse(configData.admin_announcements)
                            : configData.admin_announcements;

                        if (Array.isArray(rawList)) {
                            rawList.forEach((announcement: any) => {
                                if (announcement.text && announcement.text.trim() !== "") {
                                    activeAlerts.push({
                                        id: announcement.id,
                                        type: 'admin_manual',
                                        priority: announcement.priority || 'info',
                                        text: announcement.text
                                    });
                                }
                            });
                        }
                    }
                }
            } catch (settingsError) {
                console.error("Error cargando anuncios desde el listado general:", settingsError);
            }

            if (JSON.stringify(activeAlerts) !== JSON.stringify(notifications)) {
                setNotifications(activeAlerts);
                setCurrentIndex(0);
            }
        } catch (error) {
            console.error("Error general al consultar alertas en la barra:", error);
        }
    };


    useEffect(() => {
        fetchLiveNotifications();

        // 🔥 ACTUALIZADO A 10 SEGUNDOS (10000ms)
        const interval = setInterval(fetchLiveNotifications, 10000);

        return () => clearInterval(interval);
    }, [notifications]);

    useEffect(() => {
        if (notifications.length <= 1) return;
        const rotateTimer = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % notifications.length);
        }, 6000);
        return () => clearInterval(rotateTimer);
    }, [notifications]);

    if (notifications.length === 0) return null;

    const currentMessage = notifications[currentIndex] || notifications;

    const getPriorityStyles = (priority: 'urgent' | 'warning' | 'info') => {
        switch (priority) {
            case 'urgent':
                return {
                    barClass: "bg-red-50 border-red-300 text-red-950 animate-[pulse_3s_infinite]",
                    badgeClass: "bg-red-600 text-white shadow-red-200",
                };
            case 'warning':
                return {
                    // Ajustamos colores para que el contraste amarillo resalte mucho más arriba del menú azul
                    barClass: "bg-amber-100/90 border-amber-300 text-amber-950 shadow-inner",
                    badgeClass: "bg-amber-600 text-white shadow-md shadow-amber-600/20",
                };
            case 'info':
                return {
                    barClass: "bg-blue-50 border-blue-200 text-blue-950",
                    badgeClass: "bg-blue-600 text-white shadow-blue-100",
                };
        }
    };

    const styles = getPriorityStyles(currentMessage.priority);

    const renderIcon = (type: string, badgeCount?: number) => {
        const badgeBase = "flex items-center gap-2 px-4 py-1.5 rounded-full font-black text-[11px] tracking-widest shadow-sm shrink-0";

        // Arreglo exacto de posiciones de vibración horizontal
        const shakeSequence = [0, -5, 5, -5, 5, -2, 2, 0];

        switch (type) {
            case 'shipment':
                return (
                    <motion.div
                        animate={{ x: shakeSequence }}
                        // Forzamos "linear" que es compatible con todos los tipados de Framer Motion
                        transition={{ repeat: Infinity, duration: 0.5, repeatDelay: 2, ease: "linear" }}
                        onClick={() => typeof navigate === 'function' && navigate('/store/receive-inventory')}
                        className={`${badgeBase} ${styles.badgeClass} cursor-pointer hover:scale-105 active:scale-95 transition-transform`}
                        title="Haga clic aquí para ir a Recibir Carga"
                    >
                        <Truck size={15} />
                        <span>REVISAR {badgeCount && `(${badgeCount})`}</span>
                    </motion.div>
                );

            case 'admin_manual':
                return (
                    <motion.div
                        // Si la prioridad es diferente a 'info' (es decir es warning o urgent), vibra
                        animate={{ x: currentMessage.priority !== 'info' ? shakeSequence : 0 }}
                        transition={{ repeat: Infinity, duration: 0.5, repeatDelay: 2, ease: "linear" }}
                        className={`${badgeBase} ${styles.badgeClass}`}
                    >
                        <Megaphone size={15} />
                        <span>{currentMessage.priority === 'urgent' ? '¡URGENTE!' : 'AVISO'}</span>
                    </motion.div>
                );

            default:
                return null;
        }
    };


    return (
        /* 🔥 CAMBIADO: Altura sube de h-9 a h-11 y agregamos border-b-2 para separar con fuerza */
        <div className={`w-full h-11 border-b-2 flex items-center justify-center relative z-50 overflow-hidden select-none px-6 transition-colors duration-500 ${styles.barClass}`}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentMessage.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    /* 🔥 CAMBIADO: El texto global de la barra sube a text-sm e incrementamos el tracking */
                    className="flex items-center gap-4 text-sm font-extrabold max-w-6xl text-center tracking-tight"
                >
                    {renderIcon(currentMessage.type, currentMessage.badgeCount)}

                    <span className="leading-tight">
                        {currentMessage.text}
                    </span>

                    {currentMessage.priority === 'urgent' && (
                        <span className="text-[11px] bg-red-600 text-white font-black px-2 py-0.5 rounded-md uppercase animate-bounce shrink-0 ml-1">
                            ¡Importante!
                        </span>
                    )}
                </motion.div>
            </AnimatePresence>

            {notifications.length > 1 && (
                <div className="absolute right-6 flex gap-1 hidden sm:flex">
                    {notifications.map((_, idx) => (
                        <div
                            key={`dot-${idx}`}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-amber-600 w-4' : 'bg-gray-300'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
