# Coûts et Monitoring du Scanner de Codes-Barres

## Vue d'ensemble

Le scanner de codes-barres utilise une cascade de méthodes pour maximiser le taux de succès tout en optimisant les coûts :

1. **Google Cloud Vision API** (principal) - Payant
2. **QuaggaJS** (fallback local) - Gratuit
3. **ZXing** (dernier recours local) - Gratuit
4. **OpenAI Vision** (fallback ultime) - Payant

## Coûts Estimés

### Google Cloud Vision API

- **Prix** : ~$1.50 par 1000 requêtes (détection de codes-barres)
- **Tier gratuit** : 1000 requêtes/mois gratuites
- **Estimation d'utilisation** : 
  - Si 10% des scans nécessitent Cloud Vision (90% réussissent avec QuaggaJS)
  - Coût réel : ~$0.15 par 1000 scans totaux
  - Pour 10,000 scans/mois : ~$1.50/mois (après tier gratuit)

**Exemple de calcul :**
- 1000 scans/mois → 0$ (tier gratuit)
- 5000 scans/mois → 100 scans Cloud Vision → ~$0.15/mois
- 10,000 scans/mois → 1000 scans Cloud Vision → ~$1.50/mois

### OpenAI Vision

- **Prix** : ~$0.01 par image (gpt-4o-mini, detail: high)
- **Utilisation** : Seulement si toutes autres méthodes échouent (<1% des cas)
- **Estimation** : 
  - Si 0.5% des scans nécessitent OpenAI
  - Pour 10,000 scans/mois : 50 scans OpenAI → ~$0.50/mois

### Coût Total Estimé

Pour **10,000 scans/mois** :
- Cloud Vision : ~$1.50/mois
- OpenAI Vision : ~$0.50/mois
- **Total** : ~$2.00/mois

Pour **100,000 scans/mois** :
- Cloud Vision : ~$15.00/mois (après tier gratuit)
- OpenAI Vision : ~$5.00/mois
- **Total** : ~$20.00/mois

## Stratégie de Monitoring

### Métriques Trackées

Le système envoie automatiquement des événements Firebase Analytics pour chaque scan :

#### Événement `barcode_scan_success`
Paramètres :
- `method` : Méthode utilisée (`cloud_vision`, `quaggajs`, `zxing`, `openai_vision`)
- `duration_ms` : Durée totale du scan en millisecondes
- `attempts` : Nombre de tentatives avant succès
- `crop_strategy` : Stratégie de crop utilisée (si applicable)
- `rotation_degrees` : Rotation appliquée (si applicable)

#### Événement `barcode_scan_failure`
Paramètres :
- `total_attempts` : Nombre total de tentatives
- `duration_ms` : Durée totale avant échec
- `methods_tried` : Liste des méthodes essayées

### Dashboard Firebase Analytics

Pour visualiser les métriques :

1. **Taux de succès par méthode** :
   - Filtrer `barcode_scan_success` par `method`
   - Calculer le pourcentage de succès pour chaque méthode

2. **Coût estimé** :
   - Compter les événements `barcode_scan_success` avec `method = cloud_vision`
   - Multiplier par $0.0015 par scan
   - Compter les événements avec `method = openai_vision`
   - Multiplier par $0.01 par scan

3. **Performance** :
   - Analyser `duration_ms` par méthode
   - Identifier les méthodes les plus rapides

4. **Taux d'échec** :
   - Compter `barcode_scan_failure` vs `barcode_scan_success`
   - Calculer le taux de succès global

### Requêtes SQL Recommandées (BigQuery)

Si vous exportez Firebase Analytics vers BigQuery :

```sql
-- Taux de succès par méthode (derniers 30 jours)
SELECT 
  event_params.value.string_value AS method,
  COUNT(*) AS success_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM 
  `your-project.analytics_123456789.events_*`,
  UNNEST(event_params) AS event_params
WHERE 
  event_name = 'barcode_scan_success'
  AND event_params.key = 'method'
  AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
GROUP BY method
ORDER BY success_count DESC;

-- Coût estimé Cloud Vision (derniers 30 jours)
SELECT 
  COUNT(*) AS cloud_vision_scans,
  COUNT(*) * 0.0015 AS estimated_cost_usd
FROM 
  `your-project.analytics_123456789.events_*`,
  UNNEST(event_params) AS event_params
WHERE 
  event_name = 'barcode_scan_success'
  AND event_params.key = 'method'
  AND event_params.value.string_value = 'cloud_vision'
  AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE());

-- Performance moyenne par méthode
SELECT 
  event_params_method.value.string_value AS method,
  AVG(CAST(event_params_duration.value.int_value AS FLOAT64)) AS avg_duration_ms,
  COUNT(*) AS count
FROM 
  `your-project.analytics_123456789.events_*`,
  UNNEST(event_params) AS event_params_method,
  UNNEST(event_params) AS event_params_duration
WHERE 
  event_name = 'barcode_scan_success'
  AND event_params_method.key = 'method'
  AND event_params_duration.key = 'duration_ms'
  AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
GROUP BY method
ORDER BY avg_duration_ms;
```

## Optimisation des Coûts

### Si Budget Limité

1. **Tester QuaggaJS comme principal** :
   - Modifier l'ordre dans `barcode-decode-web.ts`
   - Tester taux de succès réel sur échantillon
   - Si taux >85%, utiliser QuaggaJS en premier

2. **Désactiver Cloud Vision** :
   - Commenter les appels à `decodeBarcodeWithCloudAPI`
   - Utiliser seulement QuaggaJS → ZXing → OpenAI

3. **Limiter OpenAI Vision** :
   - Utiliser seulement pour images très floues
   - Ajouter un seuil de confiance avant d'appeler OpenAI

### Alertes Recommandées

Configurer des alertes dans Firebase Console ou Google Cloud :

1. **Coût mensuel** : Alerter si > $50/mois
2. **Taux d'échec** : Alerter si > 20%
3. **Latence** : Alerter si durée moyenne > 5 secondes

## Références

- [Google Cloud Vision API Pricing](https://cloud.google.com/vision/pricing)
- [OpenAI Vision API Pricing](https://openai.com/pricing)
- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
