package app.honor.bienestar;

import android.app.Activity;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;

public class HealthPrivacyActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView text = new TextView(this);
        text.setTextSize(17);
        text.setPadding(36, 48, 36, 48);
        text.setText("Tus datos de salud\n\nHonor · Mi bienestar lee únicamente las mediciones que autorices en Health Connect, cuando solicitas una consulta. No escribe ni elimina datos de otras aplicaciones y no consulta en segundo plano.\n\nPuedes revisar la lectura antes de guardarla en tu historial. Los registros quedan en el almacenamiento privado de esta aplicación. Si conectas tu cuenta de Google, se envían a tu historial privado del proyecto Firebase honor-bienestar para verlos en tus dispositivos.\n\nPuedes revocar los permisos desde Health Connect y cerrar tu sesión desde Ajustes. No se usan datos de salud para publicidad. La compatibilidad depende de que la aplicación de origen comparta sus mediciones.\n\nLa voz requiere permiso de micrófono. El servicio de reconocimiento de Android puede procesar audio en sus servidores; Honor conserva solo las respuestas y transcripciones que guardas, sin grabaciones de audio.\n\nEl peso y los datos del reloj no alteran la fórmula de tu indicador personal. La aplicación no ofrece diagnósticos médicos.");
        ScrollView scroll = new ScrollView(this); scroll.addView(text); setContentView(scroll);
    }
}
